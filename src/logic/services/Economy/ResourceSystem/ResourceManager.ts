import Decimal from "break_infinity.js"
import { Resource } from "./Resource"
import type { ResourceData } from "@/shared/types/Resource"
import { Saveable } from "../../GameSave/Isaveable";

export interface ResourceRequest {
    // Уникальный идентификатор запроса (для связывания с результатом)
    id: string;

    // Приоритет (0 — самый высокий)
    priority: number;

    // Что нужно потребить
    consumes: Record<string, Decimal>;

    // Что будет произведено
    produces: Record<string, Decimal>;

    // Дополнительные метаданные (например, id здания, тип юнита)
    metadata?: unknown;
}


export interface ResourceResult {
    // Ссылка на исходный запрос (по id)
    requestId: string;

    // Коэффициент удовлетворения (0..1)
    satisfactionCoeff: Decimal;

    // Фактически потреблённые ресурсы
    actualConsumes: Record<string, Decimal>;

    // Фактически произведённые ресурсы
    actualProduces: Record<string, Decimal>;

    // Дополнительные метаданные (копируются из запроса)
    metadata?: unknown;
}

interface IBalanceHistory {
    count: Decimal,
    income: Decimal,
    expense: Decimal
}



export class ResourceManager implements Saveable {
    private resources: Record<string, Resource>;

    private balanceHistory: Record<string, IBalanceHistory[]> = {};

    private balanceHistoryLength: number = 100;

    private pendingIncome: Record<string, Decimal> = {};
    private pendingExpense: Record<string, Decimal> = {};

    constructor(data: ResourceData[]) {
        this.resources = data.reduce((acc, element) => {
            acc[element.id] = new Resource(element);
            return acc;
        },
            {} as Record<string, Resource>);

        this.balanceHistory = data.reduce((acc, resource) => {
            acc[resource.id] = [];
            return acc;
        }, {} as Record<string, IBalanceHistory[]>);
        for (const [id, resource] of Object.entries(this.resources)) {
        const count = resource.getResourceCount();
        this.balanceHistory[id].push({ count, income: new Decimal(0), expense: new Decimal(0) });
    }
    }
    /*
    Метод принимает запрос на производство. (От здания или от чего либо еще) и возвращает итоговый ожидаемый результат выполнения(не применяя его),
    в итоговый результат для каждого из запроса входят 
    - id запроса
    - процент удовлетворения запроса
    - потребленные ресурсы
    - начисленные ресурсы
    - метаданные из запроса
    */
    public processRequests(requests: ResourceRequest[]): ResourceResult[] {
        //1. Сортировка и группировка
        // Сортируем запросы по приоритету, в порядке убывания, но где 0 - самый низкий, 1 - самый высокий (0 < менее важен чем любое число, 1 >  наибольший приоритет)
        // после сортировки группируем запросы по группам приоритетов, где каждое число приоритета - своя группа.
        
        //сортируем в порядке убывания. (0 - самый низкий приоритет, 1 - самый высокий)
        const sortedRequests = requests.sort((a, b) => {
            const aVal = a.priority === 0 ? Number.MAX_SAFE_INTEGER : a.priority;
            const bVal = b.priority === 0 ? Number.MAX_SAFE_INTEGER : b.priority;
            return aVal - bVal;
        });

        //создаём группы
        const groups = new Map<number, ResourceRequest[]>();
        for (const req of sortedRequests) {
            if (!groups.has(req.priority)) {
                groups.set(req.priority, []);
            }
            groups.get(req.priority)!.push(req);
        }
        //сортируем группы
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === 0) return 1;//если a = 0, то положительное число (b стоит раньше a) 0 - самый низкий
            if (b === 0) return -1;//если b = 0, то отрицательно число (a стоит раньше b) 0 - самый низкий
            return a - b;// если не 0, то в порядке убывания
        });// по итогу приоритет 0 будет на последнем месте, 1 на первом.
        //2. Создаём копию текущих ресурсов( не изменяем реальные!!!)
        const available = Object.fromEntries(Object.entries(this.resources).map(([id, res]) => [id, res.getResourceCount()]))
        //3.Для каждой группы от высшего приоритета к низшему
        const allResults: ResourceResult[] = [];
        for(const priority of sortedKeys){
            const group = groups.get(priority);
            if(!group){continue}
            const groupResults = this.processGroup(group,available);//4 обрабатываем каждую группу приоритетов отдельно
            allResults.push(...groupResults);
        }

        return allResults;
    }

    private processGroup(group: ResourceRequest[], available: Record<string, Decimal>): ResourceResult[]{
        // pending — запросы, ещё не обработанные в этой группе
        let pending: ResourceRequest[] = [...group]; 
        const results: ResourceResult[] = [];

            // Пока есть необработанные запросы
    while (pending.length > 0) {
        // 1. Суммируем потребление по всем ресурсам
        const totalNeeded: Record<string, Decimal> = {};
        for (const required of pending) {
            for (const [res, amount] of Object.entries(required.consumes)) {
                if (!totalNeeded[res]) totalNeeded[res] = new Decimal(0);
                totalNeeded[res] = totalNeeded[res].plus(amount);
            }
        }

        // 2. Вычисляем коэффициенты удовлетворения запроса для каждого ресурса (сколько раз можно удовлетворить запрос. Например wood = 5, в запросе wood = 2. Коэф = 5/2 =2.5 2.5>1 значит полностью хватает)
        const coeff: Record<string, Decimal> = {};
        let minCoeff = new Decimal(1);
        let criticalRes: string | null = null;
        for (const [res, needed] of Object.entries(totalNeeded)) {
            const availableAmount = available[res] ?? new Decimal(0);
            if (needed.gt(0)) {
                const c = availableAmount.dividedBy(needed);
                coeff[res] = Decimal.min(c, new Decimal(1));
                if (coeff[res].lt(minCoeff)) {
                    minCoeff = coeff[res];
                    criticalRes = res;
                }
            } else {
                coeff[res] = new Decimal(1);
            }
        }

        // 3. Если минимальный коэффициент >= 1, все оставшиеся запросы удовлетворяются полностью
        if (minCoeff.gte(1) || criticalRes === null) {
            for (const req of pending) {
                results.push({
                    requestId: req.id,
                    satisfactionCoeff: new Decimal(1),
                    actualConsumes: { ...req.consumes },
                    actualProduces: { ...req.produces },
                    metadata: req.metadata,
                });

                // Списываем потребление из общего запаса, чтобы следующая
                // группа приоритетов видела только реальный остаток.
                for (const [res, amount] of Object.entries(req.consumes)) {
                    if (available[res] !== undefined) {
                        available[res] = available[res].minus(amount);
                    }
                }
            }
            break;
        }

        // 4. Находим запросы, которые потребляют критический ресурс
        const affected: ResourceRequest[] = [];
        const newPending: ResourceRequest[] = [];
        for (const required of pending) {
            if (required.consumes[criticalRes] !== undefined) {
                affected.push(required);
            } else {
                newPending.push(required);
            }
        }

        // 5. Обрабатываем affected запросы с коэффициентом minCoeff
        const coeffValue = minCoeff;
        for (const req of affected) {
            const actualConsumes: Record<string, Decimal> = {};
            for (const [res, amount] of Object.entries(req.consumes)) {
                actualConsumes[res] = amount.times(coeffValue);//умножаем ВСЕ ресурсы запроса на минимальный коэффициент
            }
            const actualProduces: Record<string, Decimal> = {};
            for (const [res, amount] of Object.entries(req.produces)) {
                actualProduces[res] = amount.times(coeffValue);//умножаем ВСЕ ресурсы производства на минимальный коэффициент
            }

            results.push({
                requestId: req.id,
                satisfactionCoeff: coeffValue,
                actualConsumes,
                actualProduces,
                metadata: req.metadata,
            });

            // 6. Обновляем available: вычитаем фактическое потребление
            for (const [res, amount] of Object.entries(actualConsumes)) {
                if (available[res] !== undefined) {
                    available[res] = available[res].minus(amount);
                }
            }
        }

        // 7. Если affected оказался пустым (не должно произойти), выходим
        if (affected.length === 0) {
            // На всякий случай: обрабатываем оставшиеся запросы с коэффициентом 1
            for (const req of pending) {
                results.push({
                    requestId: req.id,
                    satisfactionCoeff: new Decimal(1),
                    actualConsumes: { ...req.consumes },
                    actualProduces: { ...req.produces },
                    metadata: req.metadata,
                });
            }
            break;
        }

        // 8. Обновляем pending для следующей итерации
        pending = newPending;
    }

    return results;
    }
    

    /* получает ResourceResult и применяет его к ресурсам, отнимая и добавляя произведенные ресурсы согласно ResourceResult*/
    public applyRequests(results: ResourceResult[]): void {
        results.forEach((element) => {
            this.reduceResources(element.actualConsumes);
            this.addResources(element.actualProduces);
        })
    }

    public reduceResources(changes: Record<string, Decimal>): boolean {//Убавить сразу несколько ресурсов
        for (const [resId, amount] of Object.entries(changes)) {
            if (amount.lt(0)) {
                return false;
            }
        }
        for (const [resId, amount] of Object.entries(changes)) {
            const resource = this.resources[resId];
            if (resource) {
                if (!this.pendingExpense[resId]) this.pendingExpense[resId] = new Decimal(0);
                this.pendingExpense[resId] = this.pendingExpense[resId].plus(amount);
                resource.reduceResource(amount);
            }
        }
        return true;
    }

    public addResources(changes: Record<string, Decimal>): boolean {//Прибавить сразу несколько ресурсов
        for (const [resId, amount] of Object.entries(changes)) {
            if (amount.lt(0)) {
                return false;
            }
        }
        for (const [resId, amount] of Object.entries(changes)) {
            const resource = this.resources[resId];
            if (resource) {
                if (!this.pendingIncome[resId]) this.pendingIncome[resId] = new Decimal(0);
                this.pendingIncome[resId] = this.pendingIncome[resId].plus(amount);
                resource.addResource(amount);
            }
        }
        return true;
    }

    /**
     * Конец хода. Вызывается из EconomySystem последней фазой хода.
     * Порядок: восстановление природы → порча излишков игрока → обрезка
     * природных пулов по их вместимости → запись истории баланса.
     */
    public tick(): void {
        this.restoreNatureResources();
        this.applySpoilage();
        this.pruneNatureResources();
        this.recordBalanceHistory();
    }

    private restoreNatureResources() {
        for (const resource of Object.values(this.resources)) {
            if (resource.getRenewable() && resource.getRenewableRate().gt(0)) {
                resource.addResource(resource.getRenewableRate().times(resource.getResourceCount()));
            }
        }
    }

    /**
     * Природные пулы не портятся, поэтому излишек игрока теряется постепенно
     * по spoilRate, а не обрезается до склада сразу.
     */
    private applySpoilage(): void {
        for (const resource of Object.values(this.resources)) {
            if (resource.getOwner() !== "nature") {
                resource.spoilExcess();
            }
        }
    }

    private recordBalanceHistory(): void {
        for (const [id, resource] of Object.entries(this.resources)) {
            const income = this.pendingIncome[id] || new Decimal(0);
            const expense = this.pendingExpense[id] || new Decimal(0);
            const count = resource.getResourceCount();
            const history = this.balanceHistory[id];
            history.push({ count, income, expense });

            const maxLength = Math.max(1, this.balanceHistoryLength);
            if (history.length > maxLength) {
                history.splice(0, history.length - maxLength);
            }

            this.pendingIncome[id] = new Decimal(0);
            this.pendingExpense[id] = new Decimal(0);
        }
    }

    /** Природные пулы не портятся, но не могут превысить свою вместимость. */
    private pruneNatureResources(): void {
        for (const resource of Object.values(this.resources)) {
            if (resource.getOwner() === "nature") {
                resource.pruneResource();
            }
        }
    }

    addResourceDirectly(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        if (!this.pendingIncome[id]) this.pendingIncome[id] = new Decimal(0);
        this.pendingIncome[id] = this.pendingIncome[id].plus(amount);
        return resource.addResource(amount);
    }

    reduceResourceDirectly(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        if (!this.pendingExpense[id]) this.pendingExpense[id] = new Decimal(0);
        this.pendingExpense[id] = this.pendingExpense[id].plus(amount);
        return resource.reduceResource(amount);
    }

    setResourceCount(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        return resource.setResourceCount(amount);
    }

    addStorage(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        return resource.addStorage(amount);
    }

    reduceStorage(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }   
        return resource.reduceStorage(amount);
    }

    setStorage(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        return resource.setStorage(amount);
    }

    hasEnough(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false
        }
        return resource.hasEnough(amount);
    }

    canAdd(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        return resource.canAdd(amount);
    }

    canReduce(id: string, amount: Decimal): boolean{
        const resource = this.resources[id];
        if(!resource){
            return false;
        }
        return resource.canReduce(amount);
    }

    isFull(id: string): boolean{
        const resource = this.resources[id]
        if(!resource){
            return false;
        }
        return resource.isFull();
    }

    isEmpty(id: string): boolean{
        const resource = this.resources[id]
        if(!resource){
            return false;
        }
        return resource.isEmpty();
    }

    getAvailableSpace(id: string): Decimal | null{
        const resource = this.resources[id];
        if(!resource){
            return null;
        }
        return resource.getAvailableSpace();
    }
    
    public hasResource(id: string): boolean {
        return this.resources.hasOwnProperty(id);
    }

    getResourceCount(id: string): Decimal | null {
        if (!this.resources[id]) { return null }
        return this.resources[id].getResourceCount();
    }

    getResourceStorage(id: string): Decimal | null{
        const resource = this.resources[id];
        if(!resource){
            return null;
        }
        return resource.getStorage();
    }

    getResource(id: string): Resource | undefined{
        if(!this.resources[id]){
            return undefined;
        }
        return this.resources[id];
    }

    getAllResources(): Record<string, Resource>{
        return this.resources;
    }

    getResourcesByOwner(owner: string): Record<string, Resource>{
        const resourcesByOwner: Record<string, Resource> = {};
        for(const [key,value] of Object.entries(this.resources)){
            if(value.owner === owner){
                resourcesByOwner[key] = value;
            }
        }
        return resourcesByOwner;
    }

    getOpenResources(): Record<string, Resource>{
        const openResources: Record<string,Resource> ={};
        for(const [key,value] of Object.entries(this.resources)){
            if(value.open === true){
                openResources[key] = value;
            }
        }
        return openResources;
    }

    getRenewableResources(): Record<string, Resource>{
        const renewableResources: Record<string,Resource> ={};
        for(const [key,value] of Object.entries(this.resources)){
            if(value.renewable === true){
                renewableResources[key] = value;
            }
        }
        return renewableResources;
    }

    getBalanceHistory(id: string, steps?: number): IBalanceHistory[] {
        const history = this.balanceHistory[id];
        if (!history) return [];
        if (steps !== undefined && steps > 0) {
            // Возвращаем последние `steps` записей
            return history.slice(-steps);
        }
        return history;
    }

    public getAverageBalance(id: string, steps?: number): Decimal | null {
        const history = this.balanceHistory[id];
        if (!history || history.length === 0) {
            return null;
        }

        // Определяем количество записей для расчёта
        const count = (steps !== undefined && steps > 0)
            ? Math.min(steps, history.length) : history.length;// если steps > длины, берём всю историю

        const records = history.slice(-count);
        if (records.length === 0) {
            return null;
        }

        let totalProfit = new Decimal(0);
        for (const entry of records) {
            totalProfit = totalProfit.plus(entry.income.minus(entry.expense));
        }

        return totalProfit.dividedBy(records.length);
    }

    getTotalIncome(id: string, steps?: number): Decimal | null{
        const history = this.balanceHistory[id];
        if (!history || history.length === 0) {
            return null;
        }

        // Определяем количество записей для расчёта
        const count = (steps !== undefined && steps > 0)
            ? Math.min(steps, history.length) : history.length;// если steps > длины, берём всю историю

        const records = history.slice(-count);
        if (records.length === 0) {
            return null;
        }

        let totalProfit = new Decimal(0);
        for (const entry of records) {
            totalProfit = totalProfit.plus(entry.income);
        }

        return totalProfit;
    }

    getTotalExpense(id: string, steps?: number): Decimal | null{
        const history = this.balanceHistory[id];
        if (!history || history.length === 0) {
            return null;
        }

        // Определяем количество записей для расчёта
        const count = (steps !== undefined && steps > 0)
            ? Math.min(steps, history.length) : history.length;// если steps > длины, берём всю историю

        const records = history.slice(-count);
        if (records.length === 0) {
            return null;
        }

        let totalExpense = new Decimal(0);
        for (const entry of records) {
            totalExpense = totalExpense.plus(entry.expense);
        }

        return totalExpense;
    }

    getCurrentBalance(id: string): Decimal | null{
        const history = this.balanceHistory[id];
        if (!history || history.length === 0) {
            return null;
        }

            return history[history.length - 1].income.minus(history[history.length - 1].expense);
    }

    public serializeForStore(){
        return {
            "resourcesManager": {
                "resources": Object.fromEntries(Object.entries(this.resources).map(([key, value]) => [key, value.serializeForStore()])),
                "balanceHistory": Object.fromEntries(Object.entries(this.balanceHistory).map(([key, history]) =>
                    [key,
                        history.map(
                            (element => ({
                                count: element.count.toFixed(2),
                                income: element.income.toFixed(2),
                                expense: element.expense.toFixed(2)
                            })
                            ))
                    ]
                )
                ),
                "balanceHistoryLength": this.balanceHistoryLength.toFixed(0)
            }
        }
    }

    public serializeForSave(): Record<string, any> {
        return {
            "resourcesManager": {
                "resources": Object.fromEntries(Object.entries(this.resources).map(([key, value]) => [key, value.serializeForSave()])),
                "balanceHistory": Object.fromEntries(Object.entries(this.balanceHistory).map(([key, history]) =>
                    [key,
                        history.map(
                            (element => ({
                                count: element.count.toString(),
                                income: element.income.toString(),
                                expense: element.expense.toString()
                            })
                            ))
                    ]
                )
                ),
                "balanceHistoryLength": this.balanceHistoryLength.toString()
            }
        }
    }

    public deserializeForSave(data: Record<string, any>): void {
        const resourcesManagerData = data.resourcesManager;


        if (!resourcesManagerData) {
            return;
        }

        if (resourcesManagerData.resources) {
            const resourcesData = resourcesManagerData.resources as Record<string, any>;
            for (const [id, resourceData] of Object.entries(resourcesData)) {
                const existingRes = this.resources[id];
                if (existingRes) {
                    existingRes.deserializeForSave(resourceData);
                }
            }
        }

        if (resourcesManagerData.balanceHistory) {
            const historyData = resourcesManagerData.balanceHistory as Record<string, any[]>;
            for (const [id, historyArray] of Object.entries(historyData)) {
                this.balanceHistory[id] = historyArray.map((entry: any) => ({
                    count: new Decimal(entry.count),
                    income: new Decimal(entry.income),
                    expense: new Decimal(entry.expense)
                }));
            }
        }

        if (resourcesManagerData.balanceHistoryLength !== undefined) {
            this.balanceHistoryLength = Number(resourcesManagerData.balanceHistoryLength);
        }

    }
}