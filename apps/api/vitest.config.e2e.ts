import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './test',
    include: ['**/e2e/*.e2e-spec.ts'],
  },
});
