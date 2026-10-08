import { useContext } from 'react';
import { useStore } from 'zustand';
import type { SyncController, SyncViewState } from '@/lib/sync/syncController';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';

/**
 * 取得同步控制器。
 * @throws Error 不在 SyncControllerContext 底下使用時
 */
export function useSyncController(): SyncController {
  const controller = useContext(SyncControllerContext);
  if (!controller) throw new Error('useSyncController 必須在 SyncControllerContext 底下使用');
  return controller;
}

/**
 * 訂閱控制器狀態的一部分，只有選到的值改變時才重新渲染。
 * @param selector 從狀態選出需要的值
 */
export function useSyncView<T>(selector: (state: SyncViewState) => T): T {
  return useStore(useSyncController().store, selector);
}
