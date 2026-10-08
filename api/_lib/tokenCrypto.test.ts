// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, parseKeyRing } from './tokenCrypto.js';

const AAD = '__Host-mstd-rt';

function keyEntry(id: string): string {
  return `${id}:${randomBytes(32).toString('base64')}`;
}

/** 把加密字串中指定段落的第一個 byte 翻轉，模擬被竄改 */
function tamper(token: string, partIndex: number): string {
  const parts = token.split('.');
  const bytes = Buffer.from(parts[partIndex], 'base64url');
  bytes[0] ^= 0xff;
  parts[partIndex] = bytes.toString('base64url');
  return parts.join('.');
}

describe('encrypt / decrypt', () => {
  it('加密後可以用同一組金鑰解回原文，並回報使用的金鑰代號', () => {
    const keys = parseKeyRing(keyEntry('k1'));
    const token = encrypt('refresh-token-value', keys, AAD);
    expect(token.split('.')[0]).toBe('k1');
    expect(decrypt(token, keys, AAD)).toEqual({ plaintext: 'refresh-token-value', keyId: 'k1' });
  });

  it('同一段原文每次加密的結果都不同（隨機 IV）', () => {
    const keys = parseKeyRing(keyEntry('k1'));
    expect(encrypt('same', keys, AAD)).not.toBe(encrypt('same', keys, AAD));
  });

  it('密文、IV 或驗證標籤被竄改時解密失敗回傳 null', () => {
    const keys = parseKeyRing(keyEntry('k1'));
    const token = encrypt('refresh-token-value', keys, AAD);
    expect(decrypt(tamper(token, 1), keys, AAD)).toBeNull();
    expect(decrypt(tamper(token, 2), keys, AAD)).toBeNull();
    expect(decrypt(tamper(token, 3), keys, AAD)).toBeNull();
  });

  it('附加資料（cookie 名稱）不同時解密失敗', () => {
    const keys = parseKeyRing(keyEntry('k1'));
    expect(decrypt(encrypt('value', keys, AAD), keys, 'other-cookie')).toBeNull();
  });

  it('格式錯誤或金鑰代號不在金鑰環裡時回傳 null', () => {
    const keys = parseKeyRing(keyEntry('k1'));
    const other = parseKeyRing(keyEntry('k9'));
    expect(decrypt('not-a-token', keys, AAD)).toBeNull();
    expect(decrypt('k1.a.b', keys, AAD)).toBeNull();
    expect(decrypt(encrypt('value', other, AAD), keys, AAD)).toBeNull();
  });

  it('金鑰輪替：舊金鑰加密的內容在新金鑰環（新在前、舊在後）仍可解密，新加密一律用第一把', () => {
    const oldEntry = keyEntry('old');
    const oldToken = encrypt('value', parseKeyRing(oldEntry), AAD);
    const rotated = parseKeyRing(`${keyEntry('new')},${oldEntry}`);
    expect(decrypt(oldToken, rotated, AAD)).toEqual({ plaintext: 'value', keyId: 'old' });
    expect(encrypt('value', rotated, AAD).split('.')[0]).toBe('new');
  });
});

describe('parseKeyRing', () => {
  it('依設定順序解析多把金鑰', () => {
    expect(parseKeyRing(`${keyEntry('a')}, ${keyEntry('b')}`).map((k) => k.id)).toEqual(['a', 'b']);
  });

  it('沒有設定、格式錯誤、代號不合法、長度不是 32 bytes 或代號重複時丟出錯誤', () => {
    expect(() => parseKeyRing(undefined)).toThrow();
    expect(() => parseKeyRing('  ')).toThrow();
    expect(() => parseKeyRing(randomBytes(32).toString('base64'))).toThrow();
    expect(() => parseKeyRing(`k.1:${randomBytes(32).toString('base64')}`)).toThrow();
    expect(() => parseKeyRing(`k1:${randomBytes(16).toString('base64')}`)).toThrow();
    expect(() => parseKeyRing(`${keyEntry('k1')},${keyEntry('k1')}`)).toThrow();
  });
});
