/** 全站路由路徑的唯一來源:路由表、導覽連結與 navigate() 都引用這裡,避免路徑字串散在各檔案 */
export const ROUTES = {
  /** 根路徑;目前轉址到 character,角色進度看板上線後(Phase B §8)會是看板頁 */
  root: '/',
  /** 角色頁:顯示哪隻角色由 useCharacterStore 的 activeCharacterId 決定,網址不帶角色 id */
  character: '/character',
  /** 資料管理頁(備份與還原) */
  backup: '/backup',
} as const;
