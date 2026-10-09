import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // 排除 .claude/ 底下的 git worktree(各自帶有獨立的 node_modules),
    // 避免掃到裡面的測試檔案時載入到另一份 React,導致 Invalid hook call
    // *.drive.test.ts 會連到真的 Google Drive,只在 pnpm test:drive 手動執行
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/*.drive.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
