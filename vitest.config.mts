import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "out/**", "build/**", "coverage/**", "e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/logic/**/*.ts", "src/integration/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/test/**",
        "src/logic/services/Economy/Generator.ts",
        "src/logic/services/Economy/BuildingSystem/**",
        "src/logic/services/Economy/PopulationSystem/**"
      ]
    }
  }
});
