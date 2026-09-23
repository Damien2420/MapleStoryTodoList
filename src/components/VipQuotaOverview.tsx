import { Badge } from '@/components/ui/badge';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import { getVipAllocation, VIP_TICKET_LEVEL_LABELS, VIP_TICKET_LEVELS } from '@/lib/vipBossCatalog';
import type { CharacterBossTrackList, VipTier } from '@/types';

interface VipQuotaOverviewProps {
  tier: VipTier;
  /** 帳號底下的角色(id 與名稱),用來標示每筆VIP BOSS屬於誰 */
  members: { id: string; name: string }[];
  /** 帳號底下所有角色目前追蹤中的VIP BOSS */
  vipBosses: CharacterBossTrackList[];
}

/**
 * 帳號的VIP重置券總覽:依券等級列出「誰用了幾張、用在哪隻王」。
 * VIP 重置券配額是整個帳號共用的,某個等級用完時,使用者需要知道是哪些角色佔用了,才知道該去哪隻角色釋出名額。
 */
export function VipQuotaOverview({ tier, members, vipBosses }: VipQuotaOverviewProps) {
  const allocation = getVipAllocation(tier);
  const levels = VIP_TICKET_LEVELS.filter((level) => allocation[level] > 0);

  return (
    <div className="flex flex-col gap-3">
      {levels.map((level) => {
        const usedBosses = vipBosses.filter((b) => b.vipTicketLevel === level);
        return (
          <div key={level} className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[level]}</span>
              <Badge variant={usedBosses.length >= allocation[level] ? 'default' : 'outline'} className="tabular-nums">
                ({usedBosses.length}/{allocation[level]})
              </Badge>
            </span>
            {usedBosses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                目前沒有角色使用這個等級
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {members
                  .filter((member) => usedBosses.some((b) => b.characterId === member.id))
                  .map((member) => (
                    <div key={member.id} className="flex flex-col gap-1.5 px-3 py-2">
                      <span className="text-sm font-semibold">{member.name}</span>
                      {usedBosses
                        .filter((b) => b.characterId === member.id)
                        .map((boss) => (
                          <div key={boss.id} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>{boss.bossName}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-normal ${DIFFICULTY_BADGE_CLASSES[boss.difficulty]}`}>
                              {boss.difficulty}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
