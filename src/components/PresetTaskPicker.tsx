import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PRESET_TASKS, PRESET_TASK_GROUPS, isPresetExpired, isPresetGroupUnlocked, sortByCategoryOrder } from '@/lib/presetTasks';

interface PresetTaskPickerProps {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** 角色等級,用來決定地區群組(如奧術之河/格蘭蒂斯)是否可選 */
  characterLevel: number;
}

interface PickableItem {
  id: string;
  name: string;
  disabled: boolean;
  disabledReason?: string;
}

/** 預設任務多選清單:依分類分組顯示,勾選後可一次套用多筆任務範本;地區群組會依角色等級鎖定 */
export function PresetTaskPicker({ selectedIds, onToggle, characterLevel }: PresetTaskPickerProps) {
  const groupedItems = useMemo(() => {
    const map = new Map<string, PickableItem[]>();
    const pushItem = (category: string, item: PickableItem) => {
      const existing = map.get(category);
      if (existing) {
        existing.push(item);
      } else {
        map.set(category, [item]);
      }
    };

    for (const group of PRESET_TASK_GROUPS) {
      if (isPresetExpired(group.id)) continue;
      const unlocked = isPresetGroupUnlocked(group, characterLevel);
      pushItem(group.pickerCategory, {
        id: group.id,
        name: group.label,
        disabled: !unlocked,
        disabledReason: unlocked ? undefined : `需要角色 ${group.zones[0].minLevel} 等後才可選擇`,
      });
    }

    for (const task of PRESET_TASKS) {
      if (isPresetExpired(task.id)) continue;
      pushItem(task.category, {
        id: task.id,
        name: task.name,
        disabled: false,
      });
    }

    return sortByCategoryOrder(Array.from(map.entries()));
  }, [characterLevel]);

  const selectableIds = useMemo(
    () => groupedItems.flatMap(([, items]) => items.filter((item) => !item.disabled).map((item) => item.id)),
    [groupedItems],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function handleToggleAll() {
    for (const id of selectableIds) {
      if (allSelected ? selectedIds.has(id) : !selectedIds.has(id)) {
        onToggle(id);
      }
    }
  }

  if (groupedItems.length === 0) {
    return <p className="text-sm text-muted-foreground">目前無預設任務範本。</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="self-end" onClick={handleToggleAll}>
        {allSelected ? '取消全選' : '全選'}
      </Button>

      <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
        {groupedItems.map(([category, items]) => (
          <div key={category} className="flex flex-col gap-1.5">
            <Marker variant="separator">
              <MarkerContent>{category}</MarkerContent>
            </Marker>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
              {items.map((item) => {
                const selected = selectedIds.has(item.id);
                const button = (
                  <label
                    className={
                      item.disabled
                        ? 'flex cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm text-muted-foreground opacity-50'
                        : selected
                          ? 'flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-primary bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground'
                          : 'flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm hover:bg-muted/60'
                    }
                  >
                    <Checkbox
                      checked={selected}
                      disabled={item.disabled}
                      onCheckedChange={() => onToggle(item.id)}
                      className="absolute h-px w-px overflow-hidden rounded-none border-0 p-0 -m-px shadow-none [clip:rect(0,0,0,0)]"
                    />
                    <span>{item.name}</span>
                  </label>
                );

                if (!item.disabled) {
                  return <div key={item.id}>{button}</div>;
                }

                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent>{item.disabledReason}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
