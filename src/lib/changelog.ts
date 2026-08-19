/** 單一版本的更新紀錄 */
export interface ChangelogEntry {
  /** 版號,遵循 SemVer(MAJOR.MINOR.PATCH) */
  version: string;
  /** 發布日期(YYYY-MM-DD) */
  date: string;
  /** 該版本的變更項目,依重要程度由上到下排列 */
  changes: string[];
}

/** 版本更新紀錄,新版本在前;Footer 的版本紀錄 Dialog 直接渲染此陣列 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-08-19',
    changes: [
      'BOSS 清單新增「攻略人數」設定，收益金額會依人數自動平分',
      '手機版任務清單/BOSS清單改為切換顯示',
      '電腦版任務清單/BOSS清單樣式優化，標題列固定不消失',
      '角色資訊排版優化',
      '自訂任務名稱字數上限及分類名稱上限調整',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-13',
    changes: ['BOSS 清單新增「燦爛的凶星」、「尤比太」'],
  },
  {
    version: '1.2.0',
    date: '2026-08-13',
    changes: [
      '新增「更新／編輯角色資料」按鈕，可重新查詢或手動修改基本資料',
      'BOSS 清單新增重置倒數時間顯示',
      '每月任務新增「冠軍戰場」預設範本',
      '新增頁尾，可查看版本更新紀錄及 Github',
      '修正新增任務時，選擇分類或重置週期後對話框有時會意外關閉的問題',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-11',
    changes: [
      '任務清單新增「每月」重置週期，可自訂建立每月任務',
      '任務清單新增「派對樂園」並提供快速建立範本',
      'BOSS 清單各週期區塊新增「全部完成」按鈕',
      '新增頁尾，顯示目前版本並可查看版本更新紀錄',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-17',
    changes: [
      '支援建立多個角色，並各自追蹤每日/每週代辦任務與完成進度',
      '新增 BOSS 討伐清單，可依難度計算水晶收益並依週期分區顯示',
      '任務/BOSS 清單支援完成狀態篩選與分類區塊收合',
      '新增角色時可透過 NEXON Open API 查詢角色資料自動帶入',
      '新增資料管理頁面，支援 Google Drive 與本機檔案備份/還原',
      '支援淺色/深色模式切換',
    ],
  },
];

/** 目前應用程式版本,取自 CHANGELOG 最新一筆 */
export const APP_VERSION = CHANGELOG[0].version;