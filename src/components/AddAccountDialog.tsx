import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { validateAccountName } from '@/lib/accountName';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';

/**
 * 新增帳號對話框(自帶觸發按鈕):輸入帳號名稱,並可從目前「未歸類」的角色裡勾選要一起加入的角色。
 * 名稱不能空白、不能超過長度上限、不能和既有帳號同名(看板用名稱當標題分組,兩個一樣的標題無法閱讀),
 * 也不能用「未歸類」這個保留名稱。送出時建立帳號,並一次把勾選的角色歸到新帳號底下。
 */
export function AddAccountDialog() {
  const accounts = useAccountStore((s) => s.accounts);
  const addAccount = useAccountStore((s) => s.addAccount);
  const characters = useCharacterStore((s) => s.characters);
  const assignCharactersToAccount = useCharacterStore((s) => s.assignCharactersToAccount);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const unassignedCharacters = characters.filter((c) => c.accountId === null);
  const trimmedName = name.trim();

  // 名稱驗證:空白只擋送出、不顯示錯誤(使用者還沒開始輸入),其餘的才顯示原因
  const nameError = validateAccountName(name, accounts);
  const canSubmit = trimmedName.length > 0 && nameError === null;

  function resetForm() {
    setName('');
    setSelectedIds(new Set());
  }

  function toggleCharacter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const accountId = addAccount({ name: trimmedName });
    if (selectedIds.size > 0) assignCharactersToAccount([...selectedIds], accountId);
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
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" />
          新增帳號
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {unassignedCharacters.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">加入角色(選填,僅列出尚未歸類的角色)</legend>
              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                {unassignedCharacters.map((character) => (
                  <label
                    key={character.id}
                    htmlFor={`account-char-${character.id}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      id={`account-char-${character.id}`}
                      checked={selectedIds.has(character.id)}
                      onCheckedChange={() => toggleCharacter(character.id)}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{character.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {character.server} · Lv.{character.level}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              新增帳號
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
