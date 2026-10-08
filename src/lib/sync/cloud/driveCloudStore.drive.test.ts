// @vitest-environment node
import { describeCloudStoreContract } from '@/lib/sync/cloud/cloudStoreContract';
import { createDriveCloudStore } from '@/lib/sync/cloud/driveCloudStore';
import type { AccessTokenProvider } from '@/lib/sync/cloud/cloudStore';

/** 這個檔案在 node 環境執行，但所屬的 tsconfig.app.json 沒有 node 型別，故自行宣告用到的部分 */
declare const process: {
  env: Record<string, string | undefined>;
  loadEnvFile(path?: string): void;
};

try {
  process.loadEnvFile('.env.local');
} catch {
  // 沒有 .env.local 時改用目前的環境變數，缺少的設定會在下面丟出明確的錯誤
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`pnpm test:drive 需要在 .env.local 設定 ${name}`);
  return value;
}

/** 用測試帳號的 refresh token 直接向 Google 換 access token，不經過 /api/auth */
function refreshTokenProvider(): AccessTokenProvider {
  let cached: string | undefined;
  return {
    async getAccessToken() {
      if (cached) return cached;
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: requireEnv('VITE_GOOGLE_CLIENT_ID'),
          client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
          refresh_token: requireEnv('DRIVE_TEST_REFRESH_TOKEN'),
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = (await res.json()) as { access_token?: string; error?: string };
      if (!data.access_token) throw new Error(`無法取得測試帳號的 access token（${data.error ?? res.status}）`);
      cached = data.access_token;
      return cached;
    },
    invalidateAccessToken(token) {
      if (cached === token) cached = undefined;
    },
  };
}

const tokens = refreshTokenProvider();
const runPrefix = `mstd-contract-${Date.now()}-`;

describeCloudStoreContract('DriveCloudStore（真 Drive）', async () => ({
  store: createDriveCloudStore(tokens),
  prefix: runPrefix,
}));
