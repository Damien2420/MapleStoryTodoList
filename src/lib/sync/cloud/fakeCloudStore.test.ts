import { describe, expect, it } from 'vitest';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { describeCloudStoreContract } from '@/lib/sync/cloud/cloudStoreContract';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';

describeCloudStoreContract('FakeCloudStore', async () => ({ store: new FakeCloudStore(), prefix: '' }));

describe('FakeCloudStore 測試輔助功能', () => {
  it('failNext 讓指定操作的下一次呼叫丟出指定錯誤，之後恢復正常', async () => {
    const store = new FakeCloudStore();
    const file = await store.create('a.json', '1');
    store.failNext('update', new CloudError('network', 'offline'));
    await expect(store.update(file.id, '2')).rejects.toMatchObject({ kind: 'network' });
    await store.update(file.id, '2');
    expect(store.contentOf('a.json')).toBe('2');
  });

  it('beforeOp 在操作執行前呼叫，可以在那一刻插入其他裝置的寫入', async () => {
    const store = new FakeCloudStore();
    const file = await store.create('a.json', 'base');
    let interleaved = false;
    store.beforeOp = async (op) => {
      if (op === 'update' && !interleaved) {
        interleaved = true;
        await store.update(file.id, 'other-device');
      }
    };
    const mine = await store.update(file.id, 'mine');
    const revisions = await store.listRevisions(file.id);
    expect(revisions).toHaveLength(3);
    expect(revisions[2]).toBe(mine.headRevisionId);
    expect(await store.downloadRevision(file.id, revisions[1])).toBe('other-device');
  });

  it('pruneRevisions 模擬 Drive 自動清掉舊歷史版本，被清掉的版本下載時回 notFound', async () => {
    const store = new FakeCloudStore();
    const file = await store.create('a.json', '1');
    await store.update(file.id, '2');
    await store.update(file.id, '3');
    store.pruneRevisions(file.id, 1);
    expect(await store.listRevisions(file.id)).toHaveLength(1);
    await expect(store.downloadRevision(file.id, file.headRevisionId)).rejects.toMatchObject({ kind: 'notFound' });
    expect(await store.download(file.id)).toBe('3');
  });

  it('contentOf 回傳最早建立的同名檔目前內容，countFiles 回傳同名檔數量', async () => {
    const store = new FakeCloudStore();
    expect(store.contentOf('a.json')).toBeUndefined();
    await store.create('a.json', 'first');
    await store.create('a.json', 'second');
    expect(store.contentOf('a.json')).toBe('first');
    expect(store.countFiles('a.json')).toBe(2);
  });
});
