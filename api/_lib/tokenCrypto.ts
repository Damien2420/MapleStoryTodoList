import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
/** 金鑰代號只允許英數、底線與連字號；不能含「.」，因為「.」是加密字串的分隔符號 */
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** 一把加密金鑰與它的代號；代號寫在加密字串開頭，解密時據此找回對應的金鑰 */
export interface EncryptionKey {
  id: string;
  key: Buffer;
}

/**
 * 解析 TOKEN_ENC_KEY 環境變數。
 * 格式為 `代號:base64金鑰`，多把以逗號分隔；第一把用來加密，全部都可用來解密，輪替時把新金鑰放最前面、舊金鑰留在後面。
 * @param raw 環境變數原始值
 * @returns 依設定順序排列的金鑰
 * @throws 沒有設定、格式錯誤、代號不合法或重複、金鑰長度不是 32 bytes
 */
export function parseKeyRing(raw: string | undefined): EncryptionKey[] {
  if (!raw || !raw.trim()) throw new Error('TOKEN_ENC_KEY is not configured');
  const keys = raw.split(',').map((entry) => {
    const separator = entry.indexOf(':');
    if (separator <= 0) throw new Error('TOKEN_ENC_KEY entries must look like id:base64key');
    const id = entry.slice(0, separator).trim();
    if (!KEY_ID_PATTERN.test(id)) throw new Error(`TOKEN_ENC_KEY key id "${id}" is invalid`);
    const key = Buffer.from(entry.slice(separator + 1).trim(), 'base64');
    if (key.length !== KEY_BYTES) throw new Error(`TOKEN_ENC_KEY key "${id}" must be ${KEY_BYTES} bytes`);
    return { id, key };
  });
  if (new Set(keys.map((k) => k.id)).size !== keys.length) throw new Error('TOKEN_ENC_KEY has duplicate key ids');
  return keys;
}

/**
 * 用金鑰環的第一把金鑰以 AES-256-GCM 加密。
 * @param plaintext 要加密的文字
 * @param keys parseKeyRing 的結果
 * @param aad 附加驗證資料（例如 cookie 名稱），解密時必須相同，避免密文被搬到別的用途
 * @returns `代號.iv.密文.tag`，各段為 base64url，可直接放進 cookie
 */
export function encrypt(plaintext: string, keys: EncryptionKey[], aad: string): string {
  const { id, key } = keys[0];
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [id, iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

/**
 * 解密 encrypt 產生的字串。任何失敗（格式錯誤、找不到金鑰、被竄改、附加資料不同）都回傳 null，不丟例外。
 * @param token encrypt 的輸出
 * @param keys parseKeyRing 的結果
 * @param aad 加密時使用的附加驗證資料
 * @returns 原文與實際使用的金鑰代號；代號不是第一把時，呼叫端應該用新金鑰重新加密
 */
export function decrypt(token: string, keys: EncryptionKey[], aad: string): { plaintext: string; keyId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [id, ivPart, dataPart, tagPart] = parts;
  const entry = keys.find((k) => k.id === id);
  if (!entry) return null;
  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, entry.key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
    return { plaintext, keyId: id };
  } catch {
    return null;
  }
}
