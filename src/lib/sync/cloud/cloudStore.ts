/** 雲端檔案的中繼資料；version 只保證單調遞增，headRevisionId 是目前內容對應的歷史版本 ID */
export interface CloudFileMeta {
  id: string;
  name: string;
  version: string;
  headRevisionId: string;
}

/**
 * 雲端錯誤分類，同步引擎依此決定下一步：
 * - unauthorized：換過 token 仍被拒絕，或 Drive 權限被撤銷 → 需要重新連線
 * - notFound：檔案或歷史版本不存在（被刪除、被 Drive 自動清掉）
 * - rateLimited：額度超過 → 稍後重試
 * - network：連不上 → 離線，稍後重試
 * - server：其他錯誤 → 稍後重試
 */
export type CloudErrorKind = 'unauthorized' | 'notFound' | 'rateLimited' | 'network' | 'server';

/** CloudStore 所有操作失敗時丟出的錯誤 */
export class CloudError extends Error {
  readonly kind: CloudErrorKind;

  constructor(kind: CloudErrorKind, message: string) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
  }
}

/** 提供 access token 的來源；authClient 直接符合這個介面 */
export interface AccessTokenProvider {
  getAccessToken(): Promise<string>;
  invalidateAccessToken(token: string): void;
}

/**
 * 同步引擎存取雲端的唯一介面，只做檔案層級的原子操作，不解析內容。
 * 正式環境是 DriveCloudStore，測試是 FakeCloudStore；兩者行為由 cloudStoreContract 保證一致。
 */
export interface CloudStore {
  /** 依檔名列出所有同名檔（Drive 允許同名），依建立時間由舊到新；沒有時回傳空陣列 */
  findFiles(name: string): Promise<CloudFileMeta[]>;
  /** 下載檔案目前的內容 */
  download(fileId: string): Promise<string>;
  /** 下載指定歷史版本的內容；版本已被清掉時丟出 notFound */
  downloadRevision(fileId: string, revisionId: string): Promise<string>;
  /** 建立新檔案（即使已有同名檔也會另外建立一個） */
  create(name: string, content: string): Promise<CloudFileMeta>;
  /** 以新內容取代檔案內容，回傳更新後的中繼資料（含這次上傳產生的 headRevisionId） */
  update(fileId: string, content: string): Promise<CloudFileMeta>;
  /** 列出檔案的歷史版本 ID，由舊到新，最後一筆等於 headRevisionId */
  listRevisions(fileId: string): Promise<string[]>;
  /** 永久刪除檔案 */
  delete(fileId: string): Promise<void>;
}

/** CloudStore 的操作名稱，供假 Drive 的失敗注入與 beforeOp 掛勾使用 */
export type CloudOp = keyof CloudStore;
