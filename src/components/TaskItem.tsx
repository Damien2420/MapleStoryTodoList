import { Hourglass, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatExpiryDate, formatTimeUntilExpiry, formatTimeUntilReset, hoursUntilExpiry, minutesUntilReset } from '@/lib/reset';
import { useNow } from '@/hooks/useNow';
import { findPresetExpiresAt } from '@/lib/presetTasks';
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
  const expiresAt = task.presetId ? findPresetExpiresAt(task.presetId) : undefined;
  const expiringSoon = expiresAt !== undefined && hoursUntilExpiry(expiresAt, now) < 24;

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
        'group flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-3',
        task.checked && 'opacity-60',
      )}
      onClick={() => toggleTask(task.id)}
    >
      <div className="flex items-center gap-3 sm:min-w-0 sm:flex-1">
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={task.checked}
            onCheckedChange={() => toggleTask(task.id)}
            aria-label={`勾選任務:${task.name}`}
            className="size-5 rounded-md"
          />
        </span>

        <div className="min-w-0 flex-1 truncate text-sm leading-snug font-medium">
          <span className={cn(task.checked && 'line-through decoration-muted-foreground')}>{task.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-8 sm:shrink-0 sm:pl-0">
        <div className="flex flex-wrap items-center gap-2">
          {task.dueDate && (
            <span className={cn('text-xs tabular-nums', overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {overdue ? '已逾期 ' : ''}
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {expiresAt !== undefined && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs tabular-nums',
                      expiringSoon ? 'font-semibold text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    <Hourglass className="size-3" />
                    {formatTimeUntilExpiry(expiresAt, now)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatExpiryDate(expiresAt)}</TooltipContent>
              </Tooltip>
              <span className="h-3 w-px bg-border" />
            </>
          )}

          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              resetImminent ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            <RefreshCw className="size-3" />
            {cycleLabel}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7 shrink-0 text-muted-foreground opacity-40 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`刪除任務:${task.name}`}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>刪除任務</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}