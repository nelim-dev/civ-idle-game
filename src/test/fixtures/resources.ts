import type { ResourceData } from "@/shared/types/Resource";
import { ResourceManager } from "@/logic/services/Economy/ResourceSystem/ResourceManager";

/**
 * Минимальный набор ресурсов для unit-тестов.
 * Не зависит от src/data/*.json, чтобы контент мог меняться отдельно.
 */
export function makeResourceData(
    overrides: Partial<ResourceData> & Pick<ResourceData, "id">
): ResourceData {
    const { id, ...rest } = overrides;
    return {
        id,
        name: id,
        description: "",
        count: "0",
        storage: "0",
        icon: "",
        open: true,
        owner: "player",
        renewable: false,
        renewRate: "0",
        ...rest
    };
}

export const WOOD = makeResourceData({ id: "Wood", count: "100", storage: "200" });

export const TREE = makeResourceData({
    id: "Tree",
    owner: "nature",
    count: "1000",
    storage: "2000",
    renewable: true,
    renewRate: "0.1"
});

export const STONE = makeResourceData({ id: "Stone", count: "50", storage: "50" });

export const FOOD = makeResourceData({ id: "Food", count: "0", storage: "100" });

export const BUILD_POWER = makeResourceData({ id: "BuildPower", count: "0", storage: "0" });

export const TEST_RESOURCES: ResourceData[] = [WOOD, TREE, STONE, FOOD, BUILD_POWER];

export function createTestResourceManager(): ResourceManager {
    return new ResourceManager(TEST_RESOURCES);
}
