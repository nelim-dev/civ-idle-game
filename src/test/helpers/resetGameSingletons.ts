import type { GameLoop } from "@/logic/GameLoop";

/**
 * Останавливает цикл и обнуляет синглтоны на globalThis.
 * Нужен для изоляции тестов: GameManager/GameLoop живут между файлами.
 */
export function resetGameSingletons(): void {
    globalThis.__gameLoop?.stop();
    globalThis.__gameLoop = undefined;
    globalThis.__gameManager = undefined;
}
