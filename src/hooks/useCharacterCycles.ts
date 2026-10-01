import { useMemo } from 'react';
import { useNow } from '@/hooks/useNow';
import { summarizeCharacterCycles } from '@/lib/characterSummary';
import { getCycleUrgency } from '@/lib/cycleUrgency';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import type { Character } from '@/types';

/**
 * 取得角色各週期(日/週/月/賽季/VIP)的進度摘要與急迫狀態,展開版週期卡與收合版跳轉磚共用。
 * @param character 目前的角色
 * @returns summary 為各週期進度與收益;urgency 為每週/每月/賽季是否急迫
 */
export function useCharacterCycles(character: Character) {
  const allTasks = useTaskStore((s) => s.tasks);
  const allBosses = useBossStore((s) => s.bosses);
  const weeklyResetDay = useSettingsStore((s) => s.settings.weeklyResetDay);
  const now = useNow();

  const tasks = useMemo(() => allTasks.filter((t) => t.characterId === character.id), [allTasks, character.id]);
  const bosses = useMemo(() => allBosses.filter((b) => b.characterId === character.id), [allBosses, character.id]);
  const summary = useMemo(() => summarizeCharacterCycles(tasks, bosses, now), [tasks, bosses, now]);
  const urgency = useMemo(
    () => getCycleUrgency(summary, bosses, weeklyResetDay, now),
    [summary, bosses, weeklyResetDay, now],
  );

  return { summary, urgency };
}
