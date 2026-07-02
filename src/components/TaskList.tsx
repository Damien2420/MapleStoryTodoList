import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { TaskItem } from '@/components/TaskItem';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
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

/** 任務清單:依自訂分類分組顯示目前角色的任務,並提供新增任務入口與完成進度摘要 */
export function TaskList({ character }: { character: Character }) {
  const allTasks = useTaskStore((s) => s.tasks);
  const toggleCategoryTasks = useTaskStore((s) => s.toggleCategoryTasks);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
            {character.name}
            <span className="text-sm font-normal text-muted-foreground">
              {character.server} · Lv.{character.level}
              {character.job && ` · ${character.job}`}
            </span>
          </h2>
          <AddTaskDialog characterId={character.id} existingCategories={existingCategories} />
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
        <div className="flex flex-col gap-5">
          {Array.from(grouped.entries()).map(([category, categoryTasks]) => {
            const categoryDoneCount = categoryTasks.filter((t) => t.checked).length;
            const allDone = categoryDoneCount === categoryTasks.length;
            const weeklyCount = categoryTasks.filter((t) => t.resetCycle === 'weekly').length;
            const dotClassName = weeklyCount > categoryTasks.length - weeklyCount ? 'bg-secondary-foreground' : 'bg-primary';

            return (
              <section
                key={category}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={cn('size-1.5 shrink-0 rounded-full', dotClassName)} />
                    {category}
                    <span className="text-xs font-normal tabular-nums text-muted-foreground">
                      ({categoryDoneCount}/{categoryTasks.length})
                    </span>
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => toggleCategoryTasks(character.id, category, !allDone)}
                  >
                    {allDone ? '取消全部' : '全部完成'}
                  </Button>
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
      )}
    </div>
  );
}
