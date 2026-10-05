import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ASTRA_SHARD_RATES,
  ASTRA_TRACE_RATES,
  DESTINY_RESOLVE_RATES,
  GENESIS_TRACE_RATES,
  GRANDIS_DAILY_SHARDS,
  SOUL_SHARD_RATES,
  type BossRateTable,
} from '@/data/weaponRates.data';
import type { WeaponKind } from '@/lib/weapon/types';
import type { BossDifficulty } from '@/types';
import { DifficultyTag, MonthlyTag } from './parts';
import { bossName, fmt, WEAPON_META } from './weaponUi';

/** 一組素材的取得量 */
interface RateGroup {
  title: string;
  note: string;
  unit: string;
  table?: BossRateTable;
  daily?: boolean;
}

const GROUPS: Record<WeaponKind, RateGroup[]> = {
  soul: [{ title: '靈魂碎片', unit: '碎片', note: '每週只取打過的週王中給最多的一隻，不平分。', table: SOUL_SHARD_RATES }],
  genesis: [{ title: '黑暗痕跡', unit: '痕跡', note: '組隊時依人數平分；套用創世通行證時 ×3。', table: GENESIS_TRACE_RATES }],
  destiny: [{ title: '敵對者的決心', unit: '決心', note: '組隊時依人數平分。', table: DESTINY_RESOLVE_RATES }],
  astra: [
    { title: '激戰的痕跡', unit: '痕跡', note: '組隊時依人數平分。', table: ASTRA_TRACE_RATES },
    { title: '艾里溫碎片 · BOSS', unit: '碎片', note: '掉落交換券，1 張 = 1 個碎片，不平分。', table: ASTRA_SHARD_RATES },
    { title: '艾里溫碎片 · 格蘭蒂斯每日任務', unit: '碎片', note: '每天只算完成的最高地區。', daily: true },
  ],
};

/**
 * 各 BOSS 取得量:疊在武器管理視窗上方,依素材分組列出這把武器所有來源的取得量,方便決定這週要打哪些 BOSS
 * @param kind 武器
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 */
export function WeaponRatesDialog({ kind, open, onOpenChange }: { kind: WeaponKind; open: boolean; onOpenChange: (open: boolean) => void }) {
  const groups = GROUPS[kind];
  const materials = [...new Set(groups.map((g) => g.title.split(' · ')[0]))].join('、');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-5 sm:max-w-lg">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="text-base font-semibold">各 BOSS 取得量</DialogTitle>
          <DialogDescription className="text-sm">
            {WEAPON_META[kind].name} · {materials}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 [scrollbar-width:thin]">
          {groups.map((g) => (
            <section key={g.title} className="flex flex-col gap-1 [&+section]:border-t [&+section]:border-border/70 [&+section]:pt-3">
              <div>
                <b className="block text-sm font-semibold">{g.title}</b>
                <small className="block text-xs text-muted-foreground">{g.note}</small>
              </div>
              <ul className="[&>li+li]:border-t [&>li+li]:border-border/50">
                {g.daily
                  ? Object.entries(GRANDIS_DAILY_SHARDS).map(([zone, n]) => (
                      <li key={zone} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="font-medium whitespace-nowrap">{zone}</span>
                        <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap">
                          <b className="font-semibold text-secondary-foreground tabular-nums">{n}</b>
                          <small className="text-xs text-muted-foreground">{g.unit} / 天</small>
                        </span>
                      </li>
                    ))
                  : Object.entries(g.table!).map(([id, row]) => (
                      <li key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
                        <BossAvatar bossCatalogId={id} name={bossName(id)} />
                        <span className="font-medium whitespace-nowrap">{bossName(id)}</span>
                        {id === 'black-mage' && <MonthlyTag />}
                        <span className="ml-auto flex flex-wrap justify-end gap-x-2.5 gap-y-1">
                          {(Object.entries(row) as [BossDifficulty, number][]).map(([difficulty, n]) => (
                            <span key={difficulty} className="inline-flex items-center gap-1 whitespace-nowrap">
                              <DifficultyTag difficulty={difficulty} />
                              <b className="font-semibold text-secondary-foreground tabular-nums">{fmt(n)}</b>
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end border-t border-border pt-3">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              關閉
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
