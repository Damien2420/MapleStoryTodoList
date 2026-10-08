import type { CloudFileMeta, CloudStore } from '@/lib/sync/cloud/cloudStore';

/**
 * 寫入指定檔名：已有同名檔就更新最早建立的那個，沒有就建立。用於每日快照與雲端還原點這類只需要一份的檔案。
 * @param cloud 雲端存取介面
 * @param name 檔名
 * @param content 新內容
 * @returns 寫入後的中繼資料
 */
export async function upsertFile(cloud: CloudStore, name: string, content: string): Promise<CloudFileMeta> {
  const [existing] = await cloud.findFiles(name);
  return existing ? cloud.update(existing.id, content) : cloud.create(name, content);
}
