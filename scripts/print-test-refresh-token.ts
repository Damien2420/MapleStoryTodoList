// 把測試帳號登入後的 __Host-mstd-rt cookie 值解密成 refresh token，貼到 .env.local 的 DRIVE_TEST_REFRESH_TOKEN。
// 用法：node scripts/print-test-refresh-token.ts "<cookie 值>"
// cookie 值在 DevTools → Application → Cookies → http://localhost:3000 → __Host-mstd-rt 複製。
// 輸出的是測試帳號的長期憑證，只貼進 .env.local（已被 git 忽略），不要貼到其他地方。
import { decrypt, parseKeyRing } from '../api/_lib/tokenCrypto.ts';

process.loadEnvFile('.env.local');

const cookieValue = process.argv[2];
if (!cookieValue) {
  console.error('用法：node scripts/print-test-refresh-token.ts "<cookie 值>"');
  process.exit(1);
}

const result = decrypt(cookieValue, parseKeyRing(process.env.TOKEN_ENC_KEY), '__Host-mstd-rt');
if (!result) {
  console.error('解密失敗：cookie 值不完整，或 .env.local 的 TOKEN_ENC_KEY 與登入時使用的不同');
  process.exit(1);
}
console.log(result.plaintext);
