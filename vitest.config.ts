import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    sequence: { concurrent: false },
    maxWorkers: 1,
    include: ["testing_framework/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/app/**",
        "src/components/**",
        "**/*.d.ts",
        "src/lib/db/types.ts",
      ],
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    testTimeout: 30000,
  },
});
