import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CharacterLookupResult } from '@/components/CharacterLookupResult';
import { CharacterFormFields } from '@/components/CharacterFormFields';
import { NexonApiError, fetchCharacterByName, isKnownServer, type NexonCharacterInfo } from '@/lib/nexon';
import { useCharacterStore } from '@/store/useCharacterStore';
import { CHARACTER_NAME_MAX_LENGTH, type Character } from '@/types';
import type { Server } from '@/lib/servers';
import { HourglassIcon, type HourglassIconHandle } from './ui/hourglass-icon';

/** HourglassIcon 的單次翻轉動畫時長(秒),loading 期間會用同一個數字重複觸發動畫 */
const LOADING_ICON_DURATION = 1;

interface CharacterUpdateDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ApiPhase = 'loading' | 'result' | 'error';

/**
 * api 來源角色的更新面板:掛載時自動向 NEXON 查詢一次最新資料,查詢成功先預覽再讓使用者確認套用。
 * 查無此角色(遊戲內改名導致存的舊名字查不到)時額外顯示改名輸入框,其他錯誤只給單純的重試按鈕。
 * Dialog 關閉時 Radix 會把這個子元件從 DOM 卸載,所以每次重新打開都會是全新掛載、重新查詢一次,不用額外處理「重置」。
 */
function ApiRefreshPanel({ character, onApplied }: { character: Character; onApplied: (info: NexonCharacterInfo) => void }) {
  const [phase, setPhase] = useState<ApiPhase>('loading');
  const [info, setInfo] = useState<NexonCharacterInfo | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [queryName, setQueryName] = useState(character.name);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameInput, setRenameInput] = useState(character.name);
  const hourglassRef = useRef<HourglassIconHandle>(null);

  // loading 期間持續播放沙漏翻轉動畫:HourglassIcon 的動畫是「觸發一次」,不是自動 loop,
  // 所以用 interval 每隔一個動畫週期(0.9 * duration 秒)重新觸發一次,做出持續轉動的效果
  useEffect(() => {
    if (phase !== 'loading') return;
    hourglassRef.current?.startAnimation();
    const intervalId = setInterval(() => {
      hourglassRef.current?.startAnimation();
    }, LOADING_ICON_DURATION * 900);
    return () => clearInterval(intervalId);
  }, [phase]);

  // Dialog 掛載時查詢一次
  useEffect(() => {
    let cancelled = false;
    fetchCharacterByName(character.name)
      .then((result) => {
        if (cancelled) return;
        if (!isKnownServer(result.world)) {
          setError('查詢結果的伺服器無法辨識，請改用手動輸入');
          setErrorCode(undefined);
          setPhase('error');
          return;
        }
        setInfo(result);
        setPhase('result');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NexonApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError(err instanceof Error ? err.message : '查詢角色時發生未預期的錯誤');
          setErrorCode(undefined);
        }
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [character.name]);

  async function runLookup(searchName: string) {
    setPhase('loading');
    setError(undefined);
    setErrorCode(undefined);
    try {
      const result = await fetchCharacterByName(searchName);
      if (!isKnownServer(result.world)) {
        setError('查詢結果的伺服器無法辨識，請改用手動輸入');
        setPhase('error');
        return;
      }
      setInfo(result);
      setPhase('result');
    } catch (err) {
      if (err instanceof NexonApiError) {
        setError(err.message);
        setErrorCode(err.code);
      } else {
        setError(err instanceof Error ? err.message : '查詢角色時發生未預期的錯誤');
      }
      setPhase('error');
    }
  }

  function openRenameDialog() {
    setRenameInput(queryName);
    setRenameDialogOpen(true);
  }

  function handleRenameSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    setRenameDialogOpen(false);
    setQueryName(trimmed);
    runLookup(trimmed);
  }

  return (
    <>
      {phase === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <HourglassIcon ref={hourglassRef} size={16} duration={LOADING_ICON_DURATION} />
          查詢中...
        </p>
      )}

      {phase === 'error' && errorCode === 'CHARACTER_NOT_FOUND' && (
        <div className="space-y-4">
          <p className="text-center text-sm text-destructive">{error}</p>
          <Button type="button" className="w-full" onClick={openRenameDialog}>
            更改名字重新查詢
          </Button>
        </div>
      )}

      {phase === 'error' && errorCode !== 'CHARACTER_NOT_FOUND' && (
        <div className="space-y-4">
          <p className="text-center text-sm text-destructive">{error}</p>
          <Button type="button" className="w-full" onClick={() => runLookup(queryName)}>
            重新查詢
          </Button>
        </div>
      )}

      {phase === 'result' && info && (
        <CharacterLookupResult info={info} onConfirm={() => onApplied(info)} onRetry={() => runLookup(queryName)} />
      )}

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>更改角色名稱</DialogTitle>
              <DialogDescription>請輸入新的角色名稱重新查詢。</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="update-character-rename-input">角色名稱</Label>
              <Input
                id="update-character-rename-input"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!renameInput.trim()}>
              查詢
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** manual 來源角色的編輯表單:每次 Dialog 重新掛載都用目前角色資料當初始值 */
function ManualEditForm({ character, onSave }: { character: Character; onSave: (patch: { name: string; server: Server; level: number; job: string }) => void }) {
  const [name, setName] = useState(character.name);
  const [server, setServer] = useState<Server>(character.server);
  const [level, setLevel] = useState(String(character.level));
  const [job, setJob] = useState<string | undefined>(character.job);

  const canSubmit = name.trim().length > 0 && name.length <= CHARACTER_NAME_MAX_LENGTH && !!job;

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !job) return;
    onSave({ name: name.trim(), server, level: Number(level) || 1, job });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CharacterFormFields
        idPrefix="update-character"
        name={name}
        onNameChange={setName}
        server={server}
        onServerChange={setServer}
        level={level}
        onLevelChange={setLevel}
        job={job}
        onJobChange={setJob}
        autoFocusName
      />
      <Button type="submit" className="w-full" disabled={!canSubmit}>
        儲存
      </Button>
    </form>
  );
}

/** 更新角色資料 Dialog:api 來源重新查詢 NEXON 資料、預覽後套用;manual 來源直接開放手動編輯欄位 */
export function CharacterUpdateDialog({ character, open, onOpenChange }: CharacterUpdateDialogProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  function handleApiApplied(info: NexonCharacterInfo) {
    if (!isKnownServer(info.world)) return;
    updateCharacter(character.id, {
      name: info.name,
      server: info.world,
      level: info.level,
      job: info.job,
      imageUrl: info.imageUrl,
    });
    toast(`已更新「${info.name}」的最新角色資料`);
    onOpenChange(false);
  }

  function handleManualSaved(patch: { name: string; server: Server; level: number; job: string }) {
    updateCharacter(character.id, patch);
    toast(`已更新「${patch.name}」的角色資料`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {character.source === 'api' ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>更新角色資料</DialogTitle>
              <DialogDescription>重新從 NEXON 查詢「{character.name}」的最新資料。</DialogDescription>
            </DialogHeader>
            <ApiRefreshPanel character={character} onApplied={handleApiApplied} />
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>編輯角色資料</DialogTitle>
              <DialogDescription>手動調整角色名稱、伺服器、等級與職業。</DialogDescription>
            </DialogHeader>
            <ManualEditForm character={character} onSave={handleManualSaved} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}