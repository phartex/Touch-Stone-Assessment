import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: ['./tests/globalSetup.ts'],
    // Integration tests share one database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
