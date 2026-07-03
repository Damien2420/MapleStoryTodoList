import { useState, useMemo } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TaskItem } from '@/components/TaskItem';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import type { Character, CharacterTask } from '@/types';

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
  dotClassName: string,
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
                <span className={cn('size-1.5 shrink-0 rounded-full', dotClassName)} />
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
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  function handleDeleteCharacter() {
    removeTasksForCharacter(character.id);
    removeCharacter(character.id);
    setDeleteConfirmOpen(false);
  }

  const tasks = useMemo(
    () => allTasks.filter((t) => t.characterId === character.id).sort((a, b) => a.order - b.order),
    [allTasks, character.id],
  );
  const grouped = useMemo(() => groupByCategory(tasks), [tasks]);
  const existingCategories = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const dailyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'daily'), [tasks]);
  const weeklyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'weekly'), [tasks]);
  const dailyDoneCount = useMemo(() => dailyTasks.filter((t) => t.checked).length, [dailyTasks]);
  const weeklyDoneCount = useMemo(() => weeklyTasks.filter((t) => t.checked).length, [weeklyTasks]);
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-0.5">
            <h2 className="truncate text-lg font-semibold text-foreground" title={character.name}>
              {character.name}
            </h2>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>{character.server}</span>
              <span aria-hidden="true">·</span>
              <span>Lv.{character.level}</span>
              {character.job && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{character.job}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`刪除角色:${character.name}`}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刪除角色</TooltipContent>
            </Tooltip>
            <AddTaskDialog characterId={character.id} existingCategories={existingCategories} />
          </div>
        </div>

        {(dailyTasks.length > 0 || weeklyTasks.length > 0) && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{character.name} 還沒有任務</p>
            <p className="text-sm text-muted-foreground">按右上角「新增任務」建立第一筆每日/每週任務</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {dailyGrouped.size > 0 &&
            renderCategoryGroup(dailyGrouped, 'bg-primary', character.id, toggleCategoryTasks, handleDeleteCategory)}
          {weeklyGrouped.size > 0 &&
            renderCategoryGroup(
              weeklyGrouped,
              'bg-secondary-foreground',
              character.id,
              toggleCategoryTasks,
              handleDeleteCategory,
            )}
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{character.name}」?</AlertDialogTitle>
            <AlertDialogDescription>此動作無法還原,將會刪除此角色以及底下所有任務的進度紀錄。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteCharacter}>
              刪除角色
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
