import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { CharacterPortrait } from '@/components/CharacterPortrait';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isUnassignedCharacter, UNASSIGNED_GROUP_ID } from '@/lib/characterBoard';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';

/** 下拉選單「暫不分配」的值;Radix Select 不接受空字串當選項值,改用未歸類的 sentinel id(不會與帳號 UUID 撞名) */
const UNASSIGNED_VALUE = UNASSIGNED_GROUP_ID;

/**
 * 分配到帳號對話框(自帶觸發按鈕):列出所有未歸類角色,每隻各自選要加入的帳號,一次套用。
 * 放在看板「未歸類」區塊,只在至少有一個帳號時由呼叫端渲染。
 * 刻意用「每列一個下拉選單」而不是「勾多隻、選一個帳號」
 * 只有一個帳號時,每列預選該帳號,打開就能直接套用;兩個以上預設「暫不分配」,由使用者逐隻選。
 * 選到的帳號在對話框開著時被刪掉(例如另一個分頁),套用時視同暫不分配,不會寫入懸空的 id。
 */
export function AssignAccountsDialog() {
  const accounts = useAccountStore((s) => s.accounts);
  const characters = useCharacterStore((s) => s.characters);
  const assignCharactersToAccount = useCharacterStore((s) => s.assignCharactersToAccount);

  const [open, setOpen] = useState(false);
  // 角色 id 對應選到的帳號 id;UNASSIGNED_VALUE 代表暫不分配
  const [selections, setSelections] = useState<Record<string, string>>({});

  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order);
  const accountIds = new Set(accounts.map((a) => a.id));
  const unassignedCharacters = characters
    .filter((c) => isUnassignedCharacter(c, accountIds))
    .sort((a, b) => a.order - b.order);

  // 只計入仍存在的帳號,帳號在途中被刪掉的列自然退回暫不分配
  const pickedCharacters = unassignedCharacters.filter((c) => accountIds.has(selections[c.id] ?? UNASSIGNED_VALUE));

  function handleOpenChange(next: boolean) {
    if (next) {
      // 每次打開都從預設值開始;在打開的當下決定,不用 effect 事後補
      const defaultValue = accounts.length === 1 ? accounts[0].id : UNASSIGNED_VALUE;
      setSelections(Object.fromEntries(unassignedCharacters.map((c) => [c.id, defaultValue])));
    }
    setOpen(next);
  }

  function handleApply() {
    if (pickedCharacters.length === 0) return;
    const idsByAccount = new Map<string, string[]>();
    for (const character of pickedCharacters) {
      const accountId = selections[character.id];
      const ids = idsByAccount.get(accountId);
      if (ids) ids.push(character.id);
      else idsByAccount.set(accountId, [character.id]);
    }
    const willEmptyUnassigned = pickedCharacters.length === unassignedCharacters.length;

    // 先關閉再寫入:未歸類清空時整個區塊(連同這個對話框)會卸載,先把對話框狀態收掉
    setOpen(false);
    for (const [accountId, ids] of idsByAccount) assignCharactersToAccount(ids, accountId);
    toast(`已將 ${pickedCharacters.length} 位角色分配到帳號`);

    // 觸發按鈕跟著未歸類區塊一起消失,Radix 無處歸還焦點會掉到 body;改把焦點交給頁面主要區域
    if (willEmptyUnassigned) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="size-4" />
          分配到帳號
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分配到帳號</DialogTitle>
          <DialogDescription>為每隻未歸類角色選擇要加入的帳號，同帳號的角色共用 VIP 等級與重置券。</DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {unassignedCharacters.map((character) => {
            const value = accountIds.has(selections[character.id] ?? UNASSIGNED_VALUE)
              ? selections[character.id]
              : UNASSIGNED_VALUE;
            const picked = value !== UNASSIGNED_VALUE;
            return (
              <li
                key={character.id}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors max-[400px]:grid-cols-1',
                  picked ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                {/* 以外觀圖作為主要辨識依據(名字相近的角色靠圖區分),所以圖明顯大於旁邊的文字 */}
                <div className="flex min-w-0 items-center gap-3">
                  <CharacterPortrait character={character} className="size-20 rounded-lg text-2xl" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{character.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {character.server} · Lv.{character.level}
                      {character.job && ` · ${character.job}`}
                    </span>
                  </div>
                </div>
                <Select
                  value={value}
                  onValueChange={(next) => setSelections((prev) => ({ ...prev, [character.id]: next }))}
                >
                  <SelectTrigger
                    aria-label={`${character.name} 要加入的帳號`}
                    className={cn('w-full', !picked && 'text-muted-foreground')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={UNASSIGNED_VALUE}>暫不分配</SelectItem>
                    {sortedAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button type="button" className="w-full" disabled={pickedCharacters.length === 0} onClick={handleApply}>
            套用({pickedCharacters.length} 位)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
