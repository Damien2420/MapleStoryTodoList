import { createContext } from 'react';
import type { SyncController } from '@/lib/sync/syncController';

/** 全站共用的同步控制器；正式環境在 main.tsx 提供，元件測試改提供用假雲端組出的控制器 */
export const SyncControllerContext = createContext<SyncController | null>(null);
