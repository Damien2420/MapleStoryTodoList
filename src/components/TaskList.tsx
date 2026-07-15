import { useMemo } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TaskItem } from '@/components/TaskItem';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTaskStore } from '@/store/useTaskStore';
import { isPresetExpired } from '@/lib/presetTasks';
import type { Character, CharacterTask } from '@/types';

/** 任務對應的預設範本是否已下架(沒有 presetId 的任務視為未下架) */
function isTaskExpired(task: CharacterTask): boolean {
  return task.presetId ? isPresetExpired(task.presetId) : false;
}

function groupByCategory(tasks: CharacterTask[]): Map<string, CharacterTask[]> {
  const groups = new Map<string, CharacterTask[]>();
  for (const task of tasks) {
    const existing = groups.get(task.category);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(task.category, [task]);
    }
  }
  return groups;
}

/** 依分類渲染單一週期(每日/每週)的任務區塊清單 */
function renderCategoryGroup(
  grouped: Map<string, CharacterTask[]>,
  cycleLabel: '每日' | '每週',
  characterId: string,
  toggleCategoryTasks: (characterId: string, category: string, checked: boolean) => void,
  onDeleteCategory: (category: string) => void,
) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from(grouped.entries()).map(([category, categoryTasks]) => {
        const categoryDoneCount = categoryTasks.filter((t) => t.checked).length;
        const allDone = categoryDoneCount === categoryTasks.length;

        return (
          <section key={category} className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant={cycleLabel === '每日' ? 'secondary' : 'outline'}>{cycleLabel}</Badge>
                {category}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  ({categoryDoneCount}/{categoryTasks.length})
                </span>
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => toggleCategoryTasks(characterId, category, !allDone)}
                >
                  {allDone ? '取消全部' : '全部完成'}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      aria-label={`刪除分類:${category}`}
                      onClick={() => onDeleteCategory(category)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>刪除分類全部任務</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {categoryTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** 任務清單:依自訂分類分組顯示目前角色的任務,並提供新增任務入口與完成進度摘要 */
export function TaskList({ character }: { character: Character }) {
  const allTasks = useTaskStore((s) => s.tasks);
  const toggleCategoryTasks = useTaskStore((s) => s.toggleCategoryTasks);
  const removeCategoryTasks = useTaskStore((s) => s.removeCategoryTasks);
  const restoreTask = useTaskStore((s) => s.restoreTask);

  const tasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.characterId === character.id && !isTaskExpired(t))
        .sort((a, b) => a.order - b.order),
    [allTasks, character.id],
  );
  const grouped = useMemo(() => groupByCategory(tasks), [tasks]);
  const existingCategories = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const dailyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'daily'), [tasks]);
  const weeklyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'weekly'), [tasks]);
  const dailyGrouped = useMemo(() => groupByCategory(dailyTasks), [dailyTasks]);
  const weeklyGrouped = useMemo(() => groupByCategory(weeklyTasks), [weeklyTasks]);

  function handleDeleteCategory(category: string) {
    const removed = removeCategoryTasks(character.id, category);
    if (removed.length === 0) return;
    toast(`已刪除「${category}」分類的 ${removed.length} 筆任務`, {
      action: {
        label: '還原',
        onClick: () => removed.forEach((task) => restoreTask(task)),
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{character.name} 還沒有任務</p>
            <p className="text-sm text-muted-foreground">建立第一筆每日/每週任務,開始追蹤進度</p>
          </div>
          <AddTaskDialog characterId={character.id} existingCategories={existingCategories} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">任務清單</p>
            <AddTaskDialog characterId={character.id} existingCategories={existingCategories} />
          </div>
          {dailyGrouped.size > 0 &&
            renderCategoryGroup(dailyGrouped, '每日', character.id, toggleCategoryTasks, handleDeleteCategory)}
          {weeklyGrouped.size > 0 &&
            renderCategoryGroup(weeklyGrouped, '每週', character.id, toggleCategoryTasks, handleDeleteCategory)}
        </div>
      )}
    </div>
  );
}
