import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloudError, type CloudFileMeta, type CloudStore } from '@/lib/sync/cloud/cloudStore';

/** contract test 的受測對象；prefix 會加在所有檔名前面，對真 Drive 用來避免碰到正式檔案 */
export interface ContractSubject {
  store: CloudStore;
  prefix: string;
}

/**
 * 對任一 CloudStore 實作跑同一組行為檢查。假 Drive 與真 Drive 都必須通過，
 * 同步引擎的測試才能信任假 Drive 的行為。
 * 測試只刪除自己建立的檔案，不列出或清理其他檔案。
 * @param label 顯示在測試名稱裡的實作名稱
 * @param setup 每條測試開始前呼叫，回傳受測對象
 */
export function describeCloudStoreContract(label: string, setup: () => Promise<ContractSubject>): void {
  describe(`CloudStore contract: ${label}`, () => {
    let subject: ContractSubject;
    const createdIds: string[] = [];

    const fileName = (suffix: string) => `${subject.prefix}contract-${suffix}.json`;

    async function create(name: string, content: string): Promise<CloudFileMeta> {
      const meta = await subject.store.create(name, content);
      createdIds.push(meta.id);
      return meta;
    }

    async function expectNotFound(promise: Promise<unknown>): Promise<void> {
      const error = await promise.then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(CloudError);
      expect((error as CloudError).kind).toBe('notFound');
    }

    beforeEach(async () => {
      subject = await setup();
    });

    afterEach(async () => {
      for (const id of createdIds.splice(0)) {
        await subject.store.delete(id).catch(() => undefined);
      }
    });

    it('建立後可依檔名找到，內容可下載，並帶有 version 與 headRevisionId', async () => {
      const name = fileName('create');
      const meta = await create(name, '{"n":1}');
      expect(meta.name).toBe(name);
      expect(meta.version).toMatch(/^\d+$/);
      expect(meta.headRevisionId).not.toBe('');

      const found = await subject.store.findFiles(name);
      expect(found).toEqual([meta]);
      expect(await subject.store.download(meta.id)).toBe('{"n":1}');
    });

    it('找不到檔名時回傳空陣列', async () => {
      expect(await subject.store.findFiles(fileName('missing'))).toEqual([]);
    });

    it('更新後 version 變大、headRevisionId 改變、下載到的是新內容', async () => {
      const created = await create(fileName('update'), '{"n":1}');
      const updated = await subject.store.update(created.id, '{"n":2}');
      expect(updated.id).toBe(created.id);
      expect(BigInt(updated.version) > BigInt(created.version)).toBe(true);
      expect(updated.headRevisionId).not.toBe(created.headRevisionId);
      expect(await subject.store.download(created.id)).toBe('{"n":2}');
      expect((await subject.store.findFiles(created.name))[0]).toEqual(updated);
    });

    it('歷史版本由舊到新排列，連續快速上傳時每次都各自產生一筆，最後一筆是目前版本', async () => {
      const created = await create(fileName('revisions'), '{"n":0}');
      const heads = [created.headRevisionId];
      for (let n = 1; n <= 3; n++) {
        heads.push((await subject.store.update(created.id, `{"n":${n}}`)).headRevisionId);
      }
      const revisions = await subject.store.listRevisions(created.id);
      expect(revisions.slice(-4)).toEqual(heads);
    });

    it('可以下載指定歷史版本的內容', async () => {
      const created = await create(fileName('revision-content'), '{"n":1}');
      await subject.store.update(created.id, '{"n":2}');
      expect(await subject.store.downloadRevision(created.id, created.headRevisionId)).toBe('{"n":1}');
    });

    it('同名檔可以並存，依建立順序列出', async () => {
      const name = fileName('duplicate');
      const first = await create(name, '{"from":"a"}');
      const second = await create(name, '{"from":"b"}');
      expect((await subject.store.findFiles(name)).map((f) => f.id)).toEqual([first.id, second.id]);
    });

    it('刪除後找不到，下載與下載歷史版本都回 notFound', async () => {
      const created = await create(fileName('delete'), '{"n":1}');
      await subject.store.delete(created.id);
      expect(await subject.store.findFiles(created.name)).toEqual([]);
      await expectNotFound(subject.store.download(created.id));
      await expectNotFound(subject.store.downloadRevision(created.id, created.headRevisionId));
    });

    it('更新不存在的檔案回 notFound', async () => {
      await expectNotFound(subject.store.update('nonexistent-file-id', '{}'));
    });
  });
}
