import { useMemo, useState } from 'react';
import { Check, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PickerCategoryList, PickerCategorySection, PickerCategoryStatus } from '@/components/PickerCategorySection';
import { getInitialOpenCategories } from '@/lib/pickerCategories';
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
  /** 角色已經建立過的預設任務 id,標示已加入並鎖住;新增角色流程沒有既有任務會省略 */
  addedIds?: ReadonlySet<string>;
}

interface PickableItem {
  id: string;
  name: string;
  disabled: boolean;
  disabledReason?: string;
  added: boolean;
  addedAt?: string;
}

/** 分類內只要有任一項目最近 7 天內上架就視為新分類 */
function isNewCategory(items: PickableItem[]): boolean {
  return items.some((item) => item.addedAt && isRecentlyAdded(item.addedAt));
}

/** 分類內的項目全部不能選,而且至少有一項是因為已加入(不是全因等級不足),視為「已全部加入」 */
function isCategoryDone(items: PickableItem[]): boolean {
  return items.every((item) => item.disabled) && items.some((item) => item.added);
}

/**
 * 預設任務多選清單:依分類分組顯示,勾選後可一次套用多筆任務範本;地區群組會依角色等級鎖定;
 * 角色已經有的任務標示已加入並鎖住;7 天內新上架的分類會標示 NEW 並排到最前面。
 * 每個分類可收合,預設展開規則見 getInitialOpenCategories(全部已加入的分類預設收合)。
 */
export function PresetTaskPicker({ selectedIds, onToggle, characterLevel, addedIds }: PresetTaskPickerProps) {
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
      const added = addedIds?.has(group.id) ?? false;
      pushItem(group.pickerCategory, {
        id: group.id,
        name: group.label,
        disabled: !unlocked || added,
        disabledReason: !unlocked
          ? `需要角色 ${group.zones[0].minLevel} 等後才可選擇`
          : added
            ? '角色已經有這些任務'
            : undefined,
        added,
        addedAt: group.addedAt,
      });
    }

    for (const task of PRESET_TASKS) {
      if (isPresetExpired(task.id)) continue;
      const added = addedIds?.has(task.id) ?? false;
      pushItem(task.category, {
        id: task.id,
        name: task.name,
        disabled: added,
        disabledReason: added ? '角色已經有這個任務' : undefined,
        added,
        addedAt: task.addedAt,
      });
    }

    // 新分類排最前面,彼此之間、其餘分類之間仍依原本目錄順序排列
    const sorted = sortByCategoryOrder(Array.from(map.entries()));
    return [...sorted].sort(([, itemsA], [, itemsB]) => Number(isNewCategory(itemsB)) - Number(isNewCategory(itemsA)));
  }, [characterLevel, addedIds]);

  const selectableIds = useMemo(
    () => groupedItems.flatMap(([, items]) => items.filter((item) => !item.disabled).map((item) => item.id)),
    [groupedItems],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  // 只在掛載時決定一次預設展開,之後由使用者自己收合/展開
  const [openCategories, setOpenCategories] = useState(() =>
    getInitialOpenCategories(groupedItems.map(([category, items]) => ({ key: category, done: isCategoryDone(items) }))),
  );
  const allOpen = groupedItems.every(([category]) => openCategories.has(category));

  function toggleCategory(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function handleToggleAllCategories() {
    setOpenCategories(allOpen ? new Set() : new Set(groupedItems.map(([category]) => category)));
  }

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
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleToggleAllCategories}>
          {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
          {allOpen ? '全部收合' : '全部展開'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectableIds.length === 0}
          onClick={handleToggleAll}
        >
          {allSelected ? '取消全選' : '全選'}
        </Button>
      </div>

      <PickerCategoryList>
        {groupedItems.map(([category, items]) => {
          const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;
          return (
            <PickerCategorySection
              key={category}
              label={
                <>
                  {category}
                  {isNewCategory(items) && <Badge variant="secondary">NEW</Badge>}
                </>
              }
              status={
                isCategoryDone(items) ? (
                  <PickerCategoryStatus tone="muted">已全部加入</PickerCategoryStatus>
                ) : selectedCount > 0 ? (
                  <PickerCategoryStatus tone="active">已選 {selectedCount}</PickerCategoryStatus>
                ) : undefined
              }
              open={openCategories.has(category)}
              onToggle={() => toggleCategory(category)}
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
                {items.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const button = (
                    <label
                      className={
                        item.added
                          ? 'relative flex cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm text-muted-foreground'
                          : item.disabled
                            ? 'relative flex cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input px-3 py-2 text-center text-sm text-muted-foreground opacity-50'
                            : selected
                              ? 'relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-primary bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50'
                              : 'relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-popover px-3 py-2 text-center text-sm hover:border-primary/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50'
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
                      {/* 手機沒有 tooltip,已加入直接寫在按鈕上 */}
                      {item.added && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-done px-1.5 text-[11px] leading-5 font-medium text-done-foreground">
                          <Check className="size-3" aria-hidden="true" />
                          已加入
                        </span>
                      )}
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
            </PickerCategorySection>
          );
        })}
      </PickerCategoryList>
    </div>
  );
}
