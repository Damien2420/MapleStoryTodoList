import { useState } from 'react';
import { format, parse } from 'date-fns';
import { ArrowLeft, CalendarIcon, ListPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { cn } from '@/lib/utils';
import { resolveSelectedPresetTasks, type PresetTask } from '@/lib/presetTasks';
import { TASK_NAME_MAX_LENGTH, type ResetCycle } from '@/types';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';

const DUE_DATE_FORMAT = 'yyyy-MM-dd';

const RESET_CYCLE_LABEL: Record<ResetCycle, string> = {
  daily: '每日',
  weekly: '每週',
  once: '一次性',
};

const WEEKDAY_LABEL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const NEW_CATEGORY_VALUE = '__new_category__';

interface AddTaskDialogProps {
  characterId: string;
  existingCategories: string[];
}

type DialogView = 'presets' | 'confirm' | 'custom';

/** 新增任務對話框:預設顯示預設任務清單,「自定義代辦任務」按鈕切換到手動輸入頁面 */
export function AddTaskDialog({ characterId, existingCategories }: AddTaskDialogProps) {
  const characterLevel = useCharacterStore((s) => s.characters.find((c) => c.id === characterId)?.level ?? 1);
  const defaultWeeklyResetDay = useSettingsStore((s) => s.settings.weeklyResetDay);
  const allTasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const addPresetTasks = useTaskStore((s) => s.addPresetTasks);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>('presets');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(existingCategories.length === 0);
  const [resetCycle, setResetCycle] = useState<ResetCycle>('daily');
  const [weeklyResetDay, setWeeklyResetDay] = useState(defaultWeeklyResetDay);
  const [dueDate, setDueDate] = useState('');
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [resolvedPresetTasks, setResolvedPresetTasks] = useState<PresetTask[]>([]);
  const [skippedPresetTasks, setSkippedPresetTasks] = useState<PresetTask[]>([]);

  function resetForm() {
    setView('presets');
    setName('');
    setCategory('');
    setIsNewCategory(existingCategories.length === 0);
    setResetCycle('daily');
    setWeeklyResetDay(defaultWeeklyResetDay);
    setDueDate('');
    setSelectedPresetIds(new Set());
    setResolvedPresetTasks([]);
    setSkippedPresetTasks([]);
  }

  function togglePreset(id: string) {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.length > TASK_NAME_MAX_LENGTH) return;
    addTask({
      characterId,
      name,
      category,
      resetCycle,
      weeklyResetDay: resetCycle === 'weekly' ? weeklyResetDay : undefined,
      dueDate: dueDate || undefined,
    });
    resetForm();
    setOpen(false);
  }

  function handleReviewPresets() {
    if (selectedPresetIds.size === 0) return;
    const resolved = resolveSelectedPresetTasks(selectedPresetIds, characterLevel);
    const existingNames = new Set(
      allTasks.filter((t) => t.characterId === characterId).map((t) => t.name),
    );
    setResolvedPresetTasks(resolved.filter((t) => !existingNames.has(t.name)));
    setSkippedPresetTasks(resolved.filter((t) => existingNames.has(t.name)));
    setView('confirm');
  }

  function handleConfirmPresets() {
    addPresetTasks(characterId, resolvedPresetTasks);
    resetForm();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" />
          新增任務
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl sm:max-h-fit">
        {view === 'presets' ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增任務</DialogTitle>
              <DialogDescription>勾選一個或多個預設任務範本,一次建立多筆任務。</DialogDescription>
            </DialogHeader>

            <PresetTaskPicker
              selectedIds={selectedPresetIds}
              onToggle={togglePreset}
              characterLevel={characterLevel}
            />

            <Button
              type="button"
              className="w-full"
              disabled={selectedPresetIds.size === 0}
              onClick={handleReviewPresets}
            >
              套用所選預設任務({selectedPresetIds.size})
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => setView('custom')}
            >
              <ListPlus className="size-4" />
              自定義代辦任務
            </Button>
          </div>
        ) : view === 'confirm' ? (
          <div className="space-y-4">
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1 text-muted-foreground"
                onClick={() => setView('presets')}
              >
                <ArrowLeft className="size-3.5" />
                返回預設任務
              </Button>
              <DialogTitle>確認建立以下任務</DialogTitle>
              <DialogDescription>確認無誤後即可建立,建立後可再自行調整。</DialogDescription>
            </DialogHeader>

            {skippedPresetTasks.length > 0 && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                以下 {skippedPresetTasks.length} 筆任務已存在於清單中,將略過建立:
                {skippedPresetTasks.map((t) => t.name).join('、')}
              </p>
            )}

            <PresetTaskPreview tasks={resolvedPresetTasks} />

            <Button
              type="button"
              className="w-full"
              disabled={resolvedPresetTasks.length === 0}
              onClick={handleConfirmPresets}
            >
              確認新增({resolvedPresetTasks.length})
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1 text-muted-foreground"
                onClick={() => setView('presets')}
              >
                <ArrowLeft className="size-3.5" />
                返回預設任務
              </Button>
              <DialogTitle>自定義代辦任務</DialogTitle>
              <DialogDescription>設定任務名稱、分類與重置週期,新增後即可開始勾選。</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="task-name">任務名稱</Label>
              <Input
                id="task-name"
                autoFocus
                placeholder="例如:每日任務、史詩副本、怪物公園...等等"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {name.length > TASK_NAME_MAX_LENGTH && (
                <p className="text-xs text-destructive">任務名稱最多 {TASK_NAME_MAX_LENGTH} 字</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-category">分類</Label>
              <Select
                value={isNewCategory ? NEW_CATEGORY_VALUE : category}
                onValueChange={(v) => {
                  if (v === NEW_CATEGORY_VALUE) {
                    setIsNewCategory(true);
                    setCategory('');
                  } else {
                    setIsNewCategory(false);
                    setCategory(v);
                  }
                }}
              >
                <SelectTrigger id="task-category" className="w-full">
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY_VALUE}>新增分類...</SelectItem>
                </SelectContent>
              </Select>
              {isNewCategory && (
                <Input
                  id="task-category-new"
                  autoFocus
                  placeholder="輸入新分類名稱,例如:日常、週王、活動"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-cycle">重置週期</Label>
              <Select value={resetCycle} onValueChange={(v) => setResetCycle(v as ResetCycle)}>
                <SelectTrigger id="task-cycle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RESET_CYCLE_LABEL) as ResetCycle[]).map((cycle) => (
                    <SelectItem key={cycle} value={cycle}>
                      {RESET_CYCLE_LABEL[cycle]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {resetCycle === 'weekly' && (
              <div className="space-y-2">
                <Label htmlFor="task-weekly-reset-day">重置日</Label>
                <Select
                  value={String(weeklyResetDay)}
                  onValueChange={(v) => setWeeklyResetDay(Number(v))}
                >
                  <SelectTrigger id="task-weekly-reset-day" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABEL.map((label, day) => (
                      <SelectItem key={day} value={String(day)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-due">截止日期(選填)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="task-due"
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start gap-2 font-normal', !dueDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="size-4" />
                    {dueDate ? format(parse(dueDate, DUE_DATE_FORMAT, new Date()), 'yyyy/MM/dd') : '選擇日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? parse(dueDate, DUE_DATE_FORMAT, new Date()) : undefined}
                    onSelect={(date) => setDueDate(date ? format(date, DUE_DATE_FORMAT) : '')}
                  />
                  {dueDate && (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => setDueDate('')}
                      >
                        清除日期
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || name.length > TASK_NAME_MAX_LENGTH}>
                新增任務
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
