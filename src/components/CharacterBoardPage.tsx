import { useMemo } from 'react';
import { ManageAccountsDialog } from '@/components/ManageAccountsDialog';
import { BoardAccountSection } from '@/components/BoardAccountSection';
import { buildCharacterBoard, resolveAccountCollapsed } from '@/lib/characterBoard';
import { useAccountStore } from '@/store/useAccountStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';

/**
 * 角色進度看板(路由 /):把所有角色依帳號分組,一列一隻角色,用進度環一眼看完每隻角色的日/週/月/賽季/VIP 完成度與討伐收益。
 * 所有數字都由 buildCharacterBoard 一次算好,底下全是純展示元件,不需要再各自 memo。
 * 刻意不用 useNow:memo 本來就會隨 store 變動重算,加時鐘只會讓整個看板每分鐘白算一次;每日重置由
 * App 既有的 60 秒檢查翻轉 checked,自然會讓這裡重算。根節點加 @container,子元件用 container query 決定窄版排版。
 */
export function CharacterBoardPage() {
  const characters = useCharacterStore((s) => s.characters);
  const accounts = useAccountStore((s) => s.accounts);
  const tasks = useTaskStore((s) => s.tasks);
  const bosses = useBossStore((s) => s.bosses);
  const collapseOverrides = useBoardStore((s) => s.collapseOverrides);
  const setAccountCollapse = useBoardStore((s) => s.setAccountCollapse);

  const groups = useMemo(
    () => buildCharacterBoard({ characters, accounts, tasks, bosses }),
    [characters, accounts, tasks, bosses],
  );

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">帳號總覽</h1>
        <ManageAccountsDialog />
      </div>

      <div className="flex flex-col gap-7">
        {groups.map((group) => {
          const collapsed = resolveAccountCollapsed(collapseOverrides[group.id], group.allDone);
          return (
            <BoardAccountSection
              key={group.id}
              group={group}
              collapsed={collapsed}
              onToggleCollapse={() => setAccountCollapse(group.id, !collapsed, group.allDone)}
            />
          );
        })}
      </div>
    </div>
  );
}
