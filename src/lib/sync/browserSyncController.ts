import { toast } from 'sonner';
import { authClient } from '@/lib/auth/browserAuthClient';
import { setBeforeMajorDelete } from '@/lib/sync/beforeDelete';
import { startSync, stopSync, syncActionDeps } from '@/lib/sync/browserSync';
import { createSyncController } from '@/lib/sync/syncController';
import { describeAppliedChanges } from '@/lib/sync/syncText';

/** 正式環境的同步控制器 */
export const syncController = createSyncController({
  auth: authClient,
  actions: syncActionDeps,
  startSync,
  stopSync,
  notify: {
    applied: (result) => toast.success(describeAppliedChanges(result)),
    error: (message) => toast.error(message),
    success: (message) => toast.success(message),
  },
});

// 刪除角色或帳號前建立還原點；不等待上傳完成，刪除照常立即生效
setBeforeMajorDelete(() => void syncController.saveRestorePointBeforeDelete());
