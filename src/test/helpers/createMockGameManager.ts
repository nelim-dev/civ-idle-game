import type { GameManager } from "@/logic/GameManager";

export interface MockGameManagerCall {
    command: string;
    payload?: unknown;
}

/**
 * Заглушка GameManager для тестов GameLoop: нужен только send.
 * Не импортирует vitest, чтобы не зависеть от контекста runner.
 */
export function createMockGameManager() {
    const calls: MockGameManagerCall[] = [];
    const send = (command: string, payload?: unknown): void => {
        calls.push({ command, payload });
    };
    const manager = { send } as unknown as GameManager;
    return { manager, send, calls };
}
