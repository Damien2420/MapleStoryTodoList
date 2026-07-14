import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NexonCharacterInfo } from '@/lib/nexon';

interface CharacterLookupResultProps {
  info: NexonCharacterInfo;
  onConfirm: () => void;
  onRetry: () => void;
}

/** 顯示 NEXON API 查詢到的角色資訊(唯讀)+ 外觀圖,查詢成功後直接沿用這份資料建立角色,不提供編輯欄位 */
export function CharacterLookupResult({ info, onConfirm, onRetry }: CharacterLookupResultProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-stretch gap-4 rounded-2xl bg-muted/40 p-4">
        {info.imageUrl && (
          <img
            src={info.imageUrl}
            alt={info.name}
            className="aspect-square w-1/2 shrink-0 rounded-xl bg-muted object-contain"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="w-full truncate text-lg font-semibold text-foreground">{info.name}</p>
          <p className="text-sm text-muted-foreground">
            {info.world} · Lv.{info.level}
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-sm font-medium text-foreground">
            <Sparkles className="size-3.5 text-muted-foreground" />
            {info.job}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-center text-xs text-muted-foreground mb-1">要使用這個角色嗎?</p>
        <Button type="button" className="w-full" onClick={onConfirm}>
          下一步
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onRetry}>
          重新查詢
        </Button>
      </div>
    </div>
  );
}
