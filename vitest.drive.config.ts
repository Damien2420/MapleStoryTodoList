import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

// 只跑連到真 Google Drive 的 contract test(pnpm test:drive),一般的 pnpm test 不會執行這些檔案
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.drive.test.ts'],
    exclude: [...configDefaults.exclude, '**/.claude/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
