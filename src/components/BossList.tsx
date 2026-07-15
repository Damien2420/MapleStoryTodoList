import { useMemo } from 'react';
import { Swords } from 'lucide-react';
import { BossItem } from '@/components/BossItem';
import { AddBossDialog } from '@/components/AddBossDialog';
import { Badge } from '@/components/ui/badge';
import { useBossStore } from '@/store/useBossStore';
import { findBossCatalogEntry, isCatalogEntryExpired } from '@/lib/bossCatalog';
import type { Character } from '@/types';

/** BOSS 討伐記錄對應的目錄項目是否已下架(沒有 bossCatalogId 視為未下架) */
function isBossExpired(boss: { bossCatalogId?: string }): boolean {
  if (!boss.bossCatalogId) return false;
  const entry = findBossCatalogEntry(boss.bossCatalogId);
  return entry ? isCatalogEntryExpired(entry) : false;
}

/** BOSS 清單:顯示目前角色綁定的 BOSS 討伐項目,並提供每日/每週預估收益總覽 */
export function BossList({ character }: { character: Character }) {
  const allBosses = useBossStore((s) => s.bosses);

  const bosses = useMemo(
    () =>
      allBosses
        .filter((b) => b.characterId === character.id && !isBossExpired(b))
        .sort((a, b) => a.order - b.order),
    [allBosses, character.id],
  );
  const dailyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'daily'), [bosses]);
  const weeklyBosses = useMemo(
    () => bosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season'),
    [bosses],
  );
  const monthlyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'monthly'), [bosses]);
  const seasonBosses = useMemo(() => bosses.filter((b) => b.category === 'season'), [bosses]);

  return (
    <div className="flex flex-col gap-6">
      {bosses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Swords className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{character.name} 還沒有追蹤中的 BOSS</p>
            <p className="text-sm text-muted-foreground">套用常見週/日 BOSS,開始追蹤討伐進度</p>
          </div>
          <AddBossDialog characterId={character.id} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">BOSS 清單</p>
            <AddBossDialog characterId={character.id} />
          </div>

          {dailyBosses.length > 0 && (
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="secondary">每日</Badge>
              </h3>
              <div className="flex flex-col divide-y divide-border">
                {dailyBosses.map((boss) => (
                  <BossItem key={boss.id} boss={boss} />
                ))}
              </div>
            </section>
          )}

          {weeklyBosses.length > 0 && (
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="outline">每週</Badge>
              </h3>
              <div className="flex flex-col divide-y divide-border">
                {weeklyBosses.map((boss) => (
                  <BossItem key={boss.id} boss={boss} />
                ))}
              </div>
            </section>
          )}

          {monthlyBosses.length > 0 && (
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="secondary">每月</Badge>
              </h3>
              <div className="flex flex-col divide-y divide-border">
                {monthlyBosses.map((boss) => (
                  <BossItem key={boss.id} boss={boss} />
                ))}
              </div>
            </section>
          )}

          {seasonBosses.length > 0 && (
            <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant="outline">賽季</Badge>
              </h3>
              <div className="flex flex-col divide-y divide-border">
                {seasonBosses.map((boss) => (
                  <BossItem key={boss.id} boss={boss} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
