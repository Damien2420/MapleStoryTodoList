import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PRESET_TASKS,
  PRESET_TASK_GROUPS,
  isPresetExpired,
  isPresetGroupUnlocked,
  isRecentlyAdded,
  sortByCategoryOrder,
} from '@/lib/presetTasks';

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
  addedAt?: string;
}

/** 分類內只要有任一項目最近 7 天內上架就視為新分類 */
function isNewCategory(items: PickableItem[]): boolean {
  return items.some((item) => item.addedAt && isRecentlyAdded(item.addedAt));
}

/** 預設任務多選清單:依分類分組顯示,勾選後可一次套用多筆任務範本;地區群組會依角色等級鎖定;7 天內新上架的分類會標示 NEW 並排到最前面 */
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
        addedAt: group.addedAt,
      });
    }

    for (const task of PRESET_TASKS) {
      if (isPresetExpired(task.id)) continue;
      pushItem(task.category, {
        id: task.id,
        name: task.name,
        disabled: false,
        addedAt: task.addedAt,
      });
    }

    // 新分類排最前面,彼此之間、其餘分類之間仍依原本目錄順序排列(Array.sort 為穩定排序)
    const sorted = sortByCategoryOrder(Array.from(map.entries()));
    return [...sorted].sort(([, itemsA], [, itemsB]) => Number(isNewCategory(itemsB)) - Number(isNewCategory(itemsA)));
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
    <div className="flex min-h-0 flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="self-end" onClick={handleToggleAll}>
        {allSelected ? '取消全選' : '全選'}
      </Button>

      <div className="flex min-h-0 max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
        {groupedItems.map(([category, items]) => (
          <div key={category} className="flex flex-col gap-1.5">
            <Marker variant="separator">
              <MarkerContent className="flex items-center gap-1.5">
                {category}
                {isNewCategory(items) && <Badge variant="secondary">NEW</Badge>}
              </MarkerContent>
            </Marker>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
              {items.map((item) => {
                const selected = selectedIds.has(item.id);
                const button = (
                  <label
                    className={
                      item.disabled
                        ? 'relative flex cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm text-muted-foreground opacity-50'
                        : selected
                          ? 'relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-primary bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50'
                          : 'relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm hover:bg-muted/60 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50'
                    }
                  >
                    <span className="sr-only">
                      <Checkbox
                        checked={selected}
                        disabled={item.disabled}
                        onCheckedChange={() => onToggle(item.id)}
                      />
                    </span>
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
