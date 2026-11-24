# Журнал решений

## 2026-11-24. Взаимодействие менеджеров и EventBus

**Контекст:** нужно однозначно разделить внутрисистемные и межсистемные
вызовы, чтобы `BuildingManager` мог получать ресурсы у `ResourceManager`
без EventBus, но системы оставались развязанными.

**Решение:**

- между системами (`EconomySystem`, `SaveManager`, будущие `ResearchSystem`
  и т.д.) — только EventBus;
- внутри одной системы менеджеры вызывают публичные методы друг друга
  напрямую, если это следует из логики;
- `BuildingManager` → `ResourceManager`: формирует `ResourceRequest[]`,
  вызывает `processRequests`, затем `applyRequests`;
- запросы одной фазы собираются в один батч, иначе приоритеты и дефицит
  распределятся неверно;
- ресурсы мутирует только `ResourceManager`; другие менеджеры не трогают
  `Resource` напрямую;
- строительство использует отдельное распределение `BuildPower`, а не общий
  `ResourceRequest`;
- обратные зависимости запрещены: `ResourceManager` не знает о зданиях;
  при необходимости уведомления — EventBus.

**Причина:** прямой вызов нужен там, где есть результат (`satisfactionCoeff`,
`actualConsumes`, `actualProduces`) и фиксированный порядок фаз; EventBus
не возвращает значения и не задаёт порядок.

**Следствия:** `EconomySystem` оркестрирует порядок фаз, менеджеры не
подписываются на `tick` самостоятельно. Детали — `docs/architecture.md` §4.2.

## 2026-11-24. Тестовый раннер и организация тестов

**Контекст:** нужен unit-раннер для логики без привязки к Next.js и UI.

**Решение:**

- раннер — Vitest 4.1.12; окружение по умолчанию `node`, jsdom включается
  docblock-ом `// @vitest-environment jsdom` только для `GameManager` и `GameLoop`;
- `globals: true`; импорт `describe/it/expect/vi` из `vitest` в текущей
  CJS-конфигурации проекта терял контекст suite, глобалы работают стабильно;
- alias `@/*` — нативное `resolve.tsconfigPaths` Vite 8, без
  `vite-tsconfig-paths`;
- тесты лежат рядом с кодом (`src/logic/**/*.test.ts`), общая инфраструктура —
  в `src/test/` (setup, helpers, fixtures);
- известные баги фиксируются `test.fails` со ссылкой на `docs/status.md`,
  а не ослаблением проверок;
- Vitest 5.1.1 не используется: в этой конфигурации терял контекст suite.

**Следствия:** `npm run test`, `npm run test:watch`, `npm run test:coverage`;
coverage включает `src/logic/**` и `src/integration/**`, легаси-модули
`Generator`, `BuildingSystem`, `PopulationSystem` исключены до своей реализации.
