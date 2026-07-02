import { Marker, MarkerContent } from '@/components/ui/marker';
import { sortByCategoryOrder, type PresetTask } from '@/lib/presetTasks';
import type { ResetCycle } from '@/types';

const RESET_CYCLE_LABEL: Record<ResetCycle, string> = {
  daily: '每日',
  weekly: '每週',
  once: '一次性',
};

interface PresetTaskPreviewProps {
  tasks: PresetTask[];
}

/** 顯示即將建立的任務清單(依分類分組),用於套用預設任務前的最終確認 */
export function PresetTaskPreview({ tasks }: PresetTaskPreviewProps) {
  const groups = new Map<string, PresetTask[]>();
  for (const task of tasks) {
    const existing = groups.get(task.category);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(task.category, [task]);
    }
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">沒有可建立的任務。</p>;
  }

  return (
    <div className="flex max-h-72 flex-col gap-4 overflow-y-auto pr-1">
      {sortByCategoryOrder(Array.from(groups.entries())).map(([category, items]) => (
        <div key={category} className="flex flex-col gap-1.5">
          <Marker variant="separator">
            <MarkerContent>{category}</MarkerContent>
          </Marker>
          <ul className="flex flex-col gap-1">
            {items.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{task.name}</span>
                <span className="text-xs text-muted-foreground">{RESET_CYCLE_LABEL[task.resetCycle]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
