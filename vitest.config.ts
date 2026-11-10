import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // db + dashboard suites share one test database, so run files one at a time.
    fileParallelism: false,
    projects: ['packages/core', 'packages/db', 'apps/dashboard'],
  },
});
