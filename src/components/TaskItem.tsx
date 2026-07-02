import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeUntilReset, minutesUntilReset } from '@/lib/reset';
import { useNow } from '@/hooks/useNow';
import type { CharacterTask } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';

function formatDueDate(dueDate: string): string {
  const [, month, day] = dueDate.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function isOverdue(task: CharacterTask): boolean {
  if (!task.dueDate || task.checked) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate) < today;
}

/** 單一任務列:勾選框 + 名稱 + 分類/週期/截止日,同一視覺節奏內共存,不使用卡片疊卡片 */
export function TaskItem({ task }: { task: CharacterTask }) {
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const restoreTask = useTaskStore((s) => s.restoreTask);
  const settings = useSettingsStore((s) => s.settings);
  const now = useNow();
  const overdue = isOverdue(task);
  const cycleLabel =
    task.resetCycle === 'once'
      ? '一次性'
      : formatTimeUntilReset(task.resetCycle, settings, now, task.weeklyResetDay);
  const resetImminent =
    task.resetCycle !== 'once' && minutesUntilReset(task.resetCycle, settings, now, task.weeklyResetDay) < 60;

  function handleDelete() {
    removeTask(task.id);
    toast(`已刪除「${task.name}」`, {
      action: {
        label: '還原',
        onClick: () => restoreTask(task),
      },
    });
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60',
        task.checked && 'opacity-60',
      )}
      onClick={() => toggleTask(task.id)}
    >
      <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.checked}
          onCheckedChange={() => toggleTask(task.id)}
          aria-label={`勾選任務:${task.name}`}
          className="size-5 rounded-md"
        />
      </span>

      <div className="min-w-0 flex-1 text-sm leading-snug font-medium">
        <span className={cn(task.checked && 'line-through decoration-muted-foreground')}>{task.name}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.dueDate && (
          <span className={cn('text-xs tabular-nums', overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
            {overdue ? '已逾期 ' : ''}
            {formatDueDate(task.dueDate)}
          </span>
        )}

        <span className={cn('text-xs', resetImminent ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          {cycleLabel}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`刪除任務:${task.name}`}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}