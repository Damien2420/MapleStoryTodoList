// 從 src/lib/changelog.ts 擷取指定版本的更新項目,轉成 Markdown 條列文字並輸出到 stdout
// 用法: node scripts/extract-changelog.mjs <version>（例如 1.2.0）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version) {
  console.error('缺少版本參數,用法: node scripts/extract-changelog.mjs <version>');
  process.exit(1);
}

const changelogPath = resolve(__dirname, '../src/lib/changelog.ts');
const source = readFileSync(changelogPath, 'utf-8');

// CHANGELOG 陣列的內容本身是合法 JS 物件陣列（型別標註只出現在 interface 與變數宣告上）,
// 擷取 `export const CHANGELOG: ChangelogEntry[] = [ ... ];` 中的陣列字面值後直接以 vm 執行取得真實陣列
const match = source.match(/export const CHANGELOG:\s*ChangelogEntry\[\]\s*=\s*(\[[\s\S]*?\n\]);/);
if (!match) {
  console.error('無法從 changelog.ts 解析出 CHANGELOG 陣列');
  process.exit(1);
}

const CHANGELOG = vm.runInNewContext(`(${match[1]})`);
const entry = CHANGELOG.find((item) => item.version === version);

if (!entry) {
  console.error(`在 changelog.ts 中找不到版本 ${version} 的紀錄`);
  process.exit(1);
}

const lines = entry.changes.map((change) => `- ${change}`);
console.log(lines.join('\n'));