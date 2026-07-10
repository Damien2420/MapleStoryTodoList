import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { isPresetExpired } from '@/lib/presetTasks';
import { findBossCatalogEntry, isCatalogEntryExpired } from '@/lib/bossCatalog';
import type { Character, CharacterTask } from '@/types';

/** 任務對應的預設範本是否已下架(沒有 presetId 的任務視為未下架) */
function isTaskExpired(task: CharacterTask): boolean {
  return task.presetId ? isPresetExpired(task.presetId) : false;
}

/** BOSS 討伐記錄對應的目錄項目是否已下架(沒有 bossCatalogId 視為未下架) */
function isBossExpired(boss: { bossCatalogId?: string }): boolean {
  if (!boss.bossCatalogId) return false;
  const entry = findBossCatalogEntry(boss.bossCatalogId);
  return entry ? isCatalogEntryExpired(entry) : false;
}

function formatCrystalTotal(value: number): string {
  return value.toLocaleString('zh-TW');
}

/** 角色總覽摘要:合併顯示任務完成進度與 BOSS 預估結晶收益,避免兩個獨立區塊高度不一致 */
export function DashboardSummary({ character }: { character: Character }) {
  const allTasks = useTaskStore((s) => s.tasks);
  const allBosses = useBossStore((s) => s.bosses);

  const tasks = useMemo(
    () => allTasks.filter((t) => t.characterId === character.id && !isTaskExpired(t)),
    [allTasks, character.id],
  );
  const bosses = useMemo(
    () => allBosses.filter((b) => b.characterId === character.id && !isBossExpired(b)),
    [allBosses, character.id],
  );

  const dailyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'daily'), [tasks]);
  const weeklyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'weekly'), [tasks]);
  const dailyDoneCount = useMemo(() => dailyTasks.filter((t) => t.checked).length, [dailyTasks]);
  const weeklyDoneCount = useMemo(() => weeklyTasks.filter((t) => t.checked).length, [weeklyTasks]);

  const dailyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'daily'), [bosses]);
  const weeklyBosses = useMemo(
    () => bosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season'),
    [bosses],
  );
  const monthlyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'monthly'), [bosses]);
  const dailyTotal = useMemo(() => dailyBosses.reduce((sum, b) => sum + b.crystalValue, 0), [dailyBosses]);
  const weeklyTotal = useMemo(() => weeklyBosses.reduce((sum, b) => sum + b.crystalValue, 0), [weeklyBosses]);
  const monthlyTotal = useMemo(() => monthlyBosses.reduce((sum, b) => sum + b.crystalValue, 0), [monthlyBosses]);

  const hasTaskSummary = dailyTasks.length > 0 || weeklyTasks.length > 0;
  const hasBossSummary = dailyBosses.length > 0 || weeklyBosses.length > 0 || monthlyBosses.length > 0;

  if (!hasTaskSummary && !hasBossSummary) return null;

  return (
    <div
      className={cn(
        'grid gap-4 rounded-lg border border-border bg-card p-4',
        hasTaskSummary && hasBossSummary && 'lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border',
      )}
    >
      {hasTaskSummary && (
        <div className={cn('flex flex-col gap-3', hasBossSummary && 'lg:pr-4')}>
          {dailyTasks.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground tabular-nums">
                每日進度 {dailyDoneCount} / {dailyTasks.length}
              </p>
              <Progress value={(dailyDoneCount / dailyTasks.length) * 100} />
            </div>
          )}

          {weeklyTasks.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground tabular-nums">
                每週進度 {weeklyDoneCount} / {weeklyTasks.length}
              </p>
              <Progress
                value={(weeklyDoneCount / weeklyTasks.length) * 100}
                indicatorClassName="bg-secondary-foreground"
              />
            </div>
          )}
        </div>
      )}

      {hasBossSummary && (
        <div
          className={cn(
            'flex flex-col gap-2 min-[350px]:flex-row min-[350px]:items-center',
            hasTaskSummary && 'lg:pl-4',
          )}
        >
          {dailyBosses.length > 0 && (
            <div className="flex min-w-0 flex-col items-center gap-1 min-[350px]:flex-1">
              <p className="flex w-full items-center justify-center gap-1 truncate text-xs text-muted-foreground sm:text-sm">
                <img src="/Intense_Power_Crystal_(Daily).png" alt="" className="size-4 shrink-0" />
                <span className="truncate">本日預估收益</span>
              </p>
              <p className="w-full truncate text-center text-sm font-semibold tabular-nums text-foreground">
                ${formatCrystalTotal(dailyTotal)}
              </p>
            </div>
          )}
          {weeklyBosses.length > 0 && (
            <div className="flex min-w-0 flex-col items-center gap-1 min-[350px]:flex-1">
              <p className="flex w-full items-center justify-center gap-1 truncate text-xs text-muted-foreground sm:text-sm">
                <img src="/Intense_Power_Crystal_(Weekly).png" alt="" className="size-4 shrink-0" />
                <span className="truncate">本週預估收益</span>
              </p>
              <p className="w-full truncate text-center text-sm font-semibold tabular-nums text-foreground">
                ${formatCrystalTotal(weeklyTotal)}
              </p>
            </div>
          )}
          {monthlyBosses.length > 0 && (
            <div className="flex min-w-0 flex-col items-center gap-1 min-[350px]:flex-1">
              <p className="flex w-full items-center justify-center gap-1 truncate text-xs text-muted-foreground sm:text-sm">
                <img src="/Intense_Power_Crystal_(Monthly).png" alt="" className="size-4 shrink-0" />
                <span className="truncate">本月預估收益</span>
              </p>
              <p className="w-full truncate text-center text-sm font-semibold tabular-nums text-foreground">
                ${formatCrystalTotal(monthlyTotal)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
