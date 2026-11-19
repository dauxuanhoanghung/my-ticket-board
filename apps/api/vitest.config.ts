import { defineConfig } from 'vitest/config';

// Unit and application tests. 
// Specs live in test/, mirroring src/:
//   src/shared/kernel/entity.ts  →  test/shared/kernel/entity.spec.ts
// E2E specs (*.e2e-spec.ts) run with vitest.config.e2e.ts instead.
export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.spec.ts'],
    exclude: ['test/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Barrels and entrypoints have no logic of their own.
      exclude: ['src/**/index.ts', 'src/main.ts'],
    },
  },
});
