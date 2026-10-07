import { cn } from '@/lib/utils';

/**
 * 套用中的痕跡加成(只有創世):通行證與暴風修練並排,沒有套用時寫「無」;
 * 暴風修練只對挑戰者伺服器的角色顯示,勾了但沒套用通行證時沒有作用,改成灰色並註明
 * @param genesisPass 是否套用創世通行證
 * @param stormTraining 是否套用暴風修練
 * @param challenger 角色是否在挑戰者伺服器
 */
export function BoostStatusRow({
  genesisPass,
  stormTraining,
  challenger,
}: {
  genesisPass: boolean;
  stormTraining: boolean;
  challenger: boolean;
}) {
  const chip = 'rounded-full px-[7px] py-px text-xs leading-[1.3] font-semibold whitespace-nowrap';
  const showStorm = challenger && stormTraining;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{genesisPass || showStorm ? '套用中痕跡加成' : '未套用痕跡加成'}</span>
      {genesisPass && <span className={cn(chip, 'bg-secondary text-secondary-foreground')}>創世通行證</span>}
      {showStorm &&
        (genesisPass ? (
          <span className={cn(chip, 'bg-secondary text-secondary-foreground')}>暴風修練</span>
        ) : (
          <span className={cn(chip, 'bg-muted text-muted-foreground')}>暴風修練（需搭配通行證）</span>
        ))}
    </div>
  );
}
