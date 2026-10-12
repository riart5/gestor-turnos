import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret',
    },
    globalSetup: './tests/globalSetup.js',
    // Todos los tests comparten la misma base SQLite: se ejecutan en serie
    fileParallelism: false,
  },
});
