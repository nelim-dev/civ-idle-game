import Decimal from "break_infinity.js"
import { Resource } from "./Resource"
import { ResourceData } from "./Resource"
import { ISaveable } from "../../GameSave/Isaveable";
import { Economica } from "next/font/google";

interface ResourceRequest {
    // Уникальный идентификатор запроса (для связывания с результатом)
    id: string | number;

    // Приоритет (0 — самый высокий)
    priority: number;

    // Что нужно потребить
    consumes: Record<string, Decimal>;

    // Что будет произведено
    produces: Record<string, Decimal>;

    // Дополнительные метаданные (например, id здания, тип юнита)
    metadata?: any;
}


interface ResourceResult {
    // Ссылка на исходный запрос (по id)
    requestId: string | number;

    // Коэффициент удовлетворения (0..1)
    satisfactionCoeff: Decimal;

    // Фактически потреблённые ресурсы
    actualConsumes: Record<string, Decimal>;

    // Фактически произведённые ресурсы
    actualProduces: Record<string, Decimal>;

    // Дополнительные метаданные (копируются из запроса)
    metadata?: any;
}

interface IBalanceHistory {
    income: Decimal,
    expense: Decimal
}

export class ResourceManager implements ISaveable {
    private resources: Record<string, Resource>;

    private balanceHistory: Record<string, IBalanceHistory[]> = {};

    private balanceHistoryLength: number = 100;

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
    }

    serializeForSave(): Record<string, any> {
        return {
            "resourcesManager": {
                "resources": Object.fromEntries(Object.entries(this.resources).map(([key, value]) => [key, value.serializeForSave()])),
                "balanceHistory": Object.fromEntries(Object.entries(this.balanceHistory).map(([key, history]) =>
                    [key,
                        history.map(
                            (element => ({
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

    deserializeForSave(data: Record<string, any>): void {
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
                    income: new Decimal(entry.income),
                    expense: new Decimal(entry.expense)
                }));
            }
        }

        if (resourcesManagerData.balanceHistoryLength as string) {
            this.balanceHistoryLength = Number(resourcesManagerData.balanceHistoryLength);
        }

    }
}