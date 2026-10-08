import { CloudError, type CloudFileMeta, type CloudOp, type CloudStore } from '@/lib/sync/cloud/cloudStore';

interface FakeRevision {
  id: string;
  content: string;
}

interface FakeFile {
  id: string;
  name: string;
  version: number;
  revisions: FakeRevision[];
}

/**
 * 記憶體版的 CloudStore，供同步引擎的多裝置情境測試使用；多台模擬裝置共用同一個實例就等於共用同一個雲端。
 * 行為與真 Drive 一致的部分由 cloudStoreContract 保證；另外提供測試輔助：
 * - beforeOp：每個操作開始前呼叫（可 await），用來在精確的時間點插入其他裝置的寫入
 * - failNext：讓指定操作的下一次呼叫失敗
 * - pruneRevisions：模擬 Drive 自動清掉舊歷史版本
 * - contentOf／countFiles：直接檢視雲端狀態，不經過操作也不觸發 beforeOp
 */
export class FakeCloudStore implements CloudStore {
  beforeOp: ((op: CloudOp, args: unknown[]) => void | Promise<void>) | undefined;

  private readonly files = new Map<string, FakeFile>();
  private readonly failures = new Map<CloudOp, CloudError[]>();
  private fileCounter = 0;
  private revisionCounter = 0;

  /** 讓指定操作的下一次呼叫丟出這個錯誤；可以連續排多個 */
  failNext(op: CloudOp, error: CloudError): void {
    const queue = this.failures.get(op) ?? [];
    queue.push(error);
    this.failures.set(op, queue);
  }

  /** 只保留檔案最後 keepLast 筆歷史版本 */
  pruneRevisions(fileId: string, keepLast: number): void {
    const file = this.requireFile(fileId);
    file.revisions = file.revisions.slice(-keepLast);
  }

  /** 最早建立的同名檔目前的內容；沒有這個檔名時回傳 undefined */
  contentOf(name: string): string | undefined {
    const file = [...this.files.values()].find((f) => f.name === name);
    return file ? this.head(file).content : undefined;
  }

  /** 同名檔的數量 */
  countFiles(name: string): number {
    return [...this.files.values()].filter((f) => f.name === name).length;
  }

  async findFiles(name: string): Promise<CloudFileMeta[]> {
    await this.enter('findFiles', [name]);
    return [...this.files.values()].filter((f) => f.name === name).map((f) => this.meta(f));
  }

  async download(fileId: string): Promise<string> {
    await this.enter('download', [fileId]);
    return this.head(this.requireFile(fileId)).content;
  }

  async downloadRevision(fileId: string, revisionId: string): Promise<string> {
    await this.enter('downloadRevision', [fileId, revisionId]);
    const revision = this.requireFile(fileId).revisions.find((r) => r.id === revisionId);
    if (!revision) throw new CloudError('notFound', `revision ${revisionId} not found`);
    return revision.content;
  }

  async create(name: string, content: string): Promise<CloudFileMeta> {
    await this.enter('create', [name, content]);
    const file: FakeFile = { id: `file-${++this.fileCounter}`, name, version: 1, revisions: [this.newRevision(content)] };
    this.files.set(file.id, file);
    return this.meta(file);
  }

  async update(fileId: string, content: string): Promise<CloudFileMeta> {
    await this.enter('update', [fileId, content]);
    const file = this.requireFile(fileId);
    file.version += 1;
    file.revisions.push(this.newRevision(content));
    return this.meta(file);
  }

  async listRevisions(fileId: string): Promise<string[]> {
    await this.enter('listRevisions', [fileId]);
    return this.requireFile(fileId).revisions.map((r) => r.id);
  }

  async delete(fileId: string): Promise<void> {
    await this.enter('delete', [fileId]);
    this.requireFile(fileId);
    this.files.delete(fileId);
  }

  /** 每個操作的共同入口：先跑 beforeOp，再檢查有沒有排定的失敗 */
  private async enter(op: CloudOp, args: unknown[]): Promise<void> {
    await this.beforeOp?.(op, args);
    const error = this.failures.get(op)?.shift();
    if (error) throw error;
  }

  private requireFile(fileId: string): FakeFile {
    const file = this.files.get(fileId);
    if (!file) throw new CloudError('notFound', `file ${fileId} not found`);
    return file;
  }

  private head(file: FakeFile): FakeRevision {
    return file.revisions[file.revisions.length - 1];
  }

  private newRevision(content: string): FakeRevision {
    return { id: `rev-${++this.revisionCounter}`, content };
  }

  private meta(file: FakeFile): CloudFileMeta {
    return { id: file.id, name: file.name, version: String(file.version), headRevisionId: this.head(file).id };
  }
}
