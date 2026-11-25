import Decimal from "break_infinity.js";
import type { ResourceData } from "@/shared/types/Resource";
import { TEST_RESOURCES } from "@/test/fixtures/resources";
import { ResourceManager } from "./ResourceManager";
import type { ResourceRequest, ResourceResult } from "./ResourceManager";

/**
 * Контракт этапа 1.2: внутри фазы производства нет обратной связи.
 * Ожидаемое поведение из docs/game-design_v1.md §4.3 и §18.6:
 * ресурс, произведённый в фазе, не потребляется другими зданиями в том же
 * ходу. Исключение — BuildPower: он произведён в производстве и расходуется
 * в фазе строительства этого же хода.
 *
 * Часть этих проверок может проходить на текущей реализации, потому что
 * processRequests уже работает со снимком запасов. Это контрактные тесты:
 * они защищают правило дизайна, а не подтверждают новую реализацию.
 */

function d(value: string | number): Decimal {
    return new Decimal(value);
}

type Overrides = Partial<Record<string, Partial<ResourceData>>>;

function createManager(overrides: Overrides = {}): ResourceManager {
    const data = TEST_RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
    return new ResourceManager(data);
}

function request(
    id: string,
    priority: number,
    consumes: Record<string, Decimal> = {},
    produces: Record<string, Decimal> = {}
): ResourceRequest {
    return { id, priority, consumes, produces };
}

function resultById(results: ResourceResult[], id: string): ResourceResult {
    const found = results.find((result) => result.requestId === id);
    if (!found) {
        throw new Error(`Нет результата для запроса ${id}`);
    }
    return found;
}

describe("фаза производства: отсутствие обратной связи", () => {
    it("произведённое в том же батче не доступно другому запросу", () => {
        const manager = createManager({
            Wood: { count: "0", storage: "1000" }
        });
        const requests = [
            request("producer", 1, {}, { Wood: d(100) }),
            request("consumer", 1, { Wood: d(100) }, { Food: d(10) })
        ];

        const results = manager.processRequests(requests);

        expect(resultById(results, "producer").satisfactionCoeff.eq(1)).toBe(true);

        const consumer = resultById(results, "consumer");
        expect(consumer.satisfactionCoeff.eq(0)).toBe(true);
        expect(consumer.actualConsumes.Wood.eq(0)).toBe(true);
        expect(consumer.actualProduces.Food.eq(0)).toBe(true);
    });

    it("после applyRequests произведённое становится доступно следующей фазе", () => {
        const manager = createManager({
            Wood: { count: "0", storage: "1000" }
        });
        const production = manager.processRequests([
            request("producer", 1, {}, { Wood: d(100) })
        ]);
        manager.applyRequests(production);

        const nextPhase = manager.processRequests([
            request("consumer", 1, { Wood: d(100) }, { Food: d(10) })
        ]);

        expect(nextPhase[0].satisfactionCoeff.eq(1)).toBe(true);
        expect(nextPhase[0].actualConsumes.Wood.eq(100)).toBe(true);
        expect(nextPhase[0].actualProduces.Food.eq(10)).toBe(true);
    });

    it("BuildPower производится в производстве, но расходуется только в строительстве", () => {
        const manager = createManager({
            BuildPower: { count: "0", storage: "1000", spoilRate: "0" },
            Wood: { count: "0", storage: "1000" }
        });

        const production = manager.processRequests([
            request("central-base", 1, {}, { BuildPower: d(20) }),
            request("production-consumer", 1, { BuildPower: d(20) }, { Wood: d(10) })
        ]);

        expect(resultById(production, "production-consumer").satisfactionCoeff.eq(0)).toBe(true);

        manager.applyRequests(production);

        const construction = manager.processRequests([
            request("construction", 1, { BuildPower: d(20) }, {})
        ]);

        expect(construction[0].satisfactionCoeff.eq(1)).toBe(true);
        expect(construction[0].actualConsumes.BuildPower.eq(20)).toBe(true);
    });
});
