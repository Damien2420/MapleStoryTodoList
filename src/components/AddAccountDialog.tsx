import { useState } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CharacterPortrait } from '@/components/CharacterPortrait';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { validateAccountName } from '@/lib/accountName';
import { isUnassignedCharacter } from '@/lib/characterBoard';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';

type Step = 'name' | 'characters';

/**
 * 新增帳號對話框(自帶觸發按鈕),兩步驟:先輸入帳號名稱,再從目前「未歸類」的角色裡選要一起加入的角色。
 * 沒有未歸類角色時不進第二步,第一步直接建立。第二步可以什麼都不選,建立空帳號。
 * 名稱不能空白、不能超過長度上限、不能和既有帳號同名(看板用名稱當標題分組,兩個一樣的標題無法閱讀),
 * 也不能用「未歸類」這個保留名稱。
 * 帳號只在最後按下建立時才寫入,中途關閉對話框什麼都不會留下;建立後一次把選到的角色歸到新帳號底下。
 */
export function AddAccountDialog() {
  const accounts = useAccountStore((s) => s.accounts);
  const addAccount = useAccountStore((s) => s.addAccount);
  const characters = useCharacterStore((s) => s.characters);
  const assignCharactersToAccount = useCharacterStore((s) => s.assignCharactersToAccount);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const accountIds = new Set(accounts.map((a) => a.id));
  const unassignedCharacters = characters
    .filter((c) => isUnassignedCharacter(c, accountIds))
    .sort((a, b) => a.order - b.order);
  const hasUnassigned = unassignedCharacters.length > 0;
  const trimmedName = name.trim();
  // 選取中的角色可能在對話框開著時被別處歸類掉,只算仍在未歸類清單裡的
  const pickedIds = selectedIds.filter((id) => unassignedCharacters.some((c) => c.id === id));
  const allPicked = hasUnassigned && pickedIds.length === unassignedCharacters.length;

  // 名稱驗證:空白只擋送出、不顯示錯誤(使用者還沒開始輸入),其餘的才顯示原因
  const nameError = validateAccountName(name, accounts);
  const canSubmitName = trimmedName.length > 0 && nameError === null;

  function resetForm() {
    setStep('name');
    setName('');
    setSelectedIds([]);
  }

  function createAccount() {
    // 第二步期間名稱可能變得不合法(例如另一個分頁建了同名帳號),退回第一步讓使用者看到原因
    if (!canSubmitName) {
      setStep('name');
      return;
    }
    const accountId = addAccount({ name: trimmedName });
    if (pickedIds.length > 0) assignCharactersToAccount(pickedIds, accountId);
    const willEmptyUnassigned = hasUnassigned && allPicked;
    toast(pickedIds.length > 0 ? `已建立「${trimmedName}」並加入 ${pickedIds.length} 位角色` : `已建立「${trimmedName}」`);
    resetForm();
    setOpen(false);

    // 從未歸類區塊打開時,角色全被加入會讓觸發按鈕跟著區塊卸載,焦點無處歸還;改交給頁面主要區域
    if (willEmptyUnassigned) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }));
    }
  }

  function handleNameSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmitName) return;
    if (hasUnassigned) setStep('characters');
    else createAccount();
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
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" />
          新增帳號
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'name' ? (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增帳號</DialogTitle>
              <DialogDescription>把同一個遊戲帳號底下的角色放在一起,在進度看板上分組檢視。</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="account-name">帳號名稱</Label>
              <Input
                id="account-name"
                autoFocus
                placeholder="例如:主力練功、小號倉庫"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={nameError !== null}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmitName}>
                {hasUnassigned ? '下一步' : '建立帳號'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1 text-muted-foreground"
                onClick={() => setStep('name')}
              >
                <ArrowLeft className="size-3.5" />
                返回帳號名稱
              </Button>
              <DialogTitle className="break-all">選擇要加入「{trimmedName}」的角色</DialogTitle>
              <DialogDescription>只列出尚未歸類的角色，可以先不選，之後再用「分配到帳號」加入。</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground tabular-nums">
                已選 {pickedIds.length} / {unassignedCharacters.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-primary"
                onClick={() => setSelectedIds(allPicked ? [] : unassignedCharacters.map((c) => c.id))}
              >
                {allPicked ? '取消全選' : '全選'}
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto p-0.5">
              <ToggleGroup
                type="multiple"
                value={pickedIds}
                onValueChange={setSelectedIds}
                aria-label="要加入的角色"
                className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4"
              >
                {unassignedCharacters.map((character) => (
                  <ToggleGroupItem
                    key={character.id}
                    value={character.id}
                    aria-label={`${character.name},${character.server},Lv.${character.level}`}
                    className="relative h-auto w-full min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden rounded-lg border border-border bg-card p-0 text-left whitespace-normal hover:border-primary/50 hover:bg-card aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-1 aria-pressed:ring-primary data-[state=on]:bg-primary/5"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 z-10 hidden size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-data-[state=on]/toggle:flex"
                    >
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    <CharacterPortrait character={character} className="aspect-square w-full text-2xl" />
                    <span className="flex min-w-0 flex-col px-2 pt-1.5 pb-2">
                      <span className="truncate text-xs font-semibold text-foreground">{character.name}</span>
                      <span className="truncate text-[10.5px] font-normal text-muted-foreground">
                        {character.server} · Lv.{character.level}
                      </span>
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <DialogFooter>
              <Button type="button" className="w-full" onClick={createAccount}>
                {pickedIds.length > 0 ? `建立並加入 ${pickedIds.length} 位角色` : '建立帳號(不加入角色)'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
