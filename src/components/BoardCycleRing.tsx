import type { BoardCycleProgress } from '@/lib/characterBoard';

/** 環中央的週期簡稱與完整名稱(完整名稱只給螢幕閱讀器) */
const CYCLE_LABELS = {
  daily: { short: '日', full: '每日' },
  weekly: { short: '週', full: '每週' },
  monthly: { short: '月', full: '每月' },
  season: { short: '賽', full: '賽季' },
  vip: { short: 'VIP', full: 'VIP 重置' },
} as const;

/** 環的幾何:viewBox 44x44,任務在外圈、BOSS 在內圈,兩圈共用同一個圓心與線寬 */
const CENTER = 22;
const STROKE_WIDTH = 4.5;
const OUTER_RADIUS = 18;
const INNER_RADIUS = 12;

/** 單一圓弧:一個軌道圈加一個從 12 點鐘方向開始的進度弧;total 為 0 時不畫進度弧,避免除以零 */
function RingArc({ radius, done, total, arcClassName }: { radius: number; done: number; total: number; arcClassName: string }) {
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? done / total : 0;
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r={radius} fill="none" strokeWidth={STROKE_WIDTH} className="stroke-muted" />
      {fraction > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className={arcClassName}
        />
      )}
    </>
  );
}

/**
 * 看板上單一週期的進度環。外圈(橘)是任務進度、內圈(鋼藍)是 BOSS 進度;週期身分只靠環中央的文字,不靠顏色。
 * 只有其中一類項目時只畫那一圈(半徑維持不變,環的外框大小固定,一列裡各週期仍然對齊),對應的文字行也只有一行;
 * VIP 環只有 BOSS,畫在外圈半徑上。整個週期都沒建立時改畫虛線圓加「未建立」。
 * @param cycle 該週期的進度資料
 */
export function BoardCycleRing({ cycle }: { cycle: BoardCycleProgress }) {
  const label = CYCLE_LABELS[cycle.cycle];

  if (!cycle.tracked) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center gap-[3px] pt-2">
        <span className="sr-only">{label.full}</span>
        <div
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-border text-[10px] text-muted-foreground opacity-55"
        >
          {label.short}
        </div>
        <div className="text-[10px] text-muted-foreground opacity-70">未建立</div>
      </div>
    );
  }

  const isVip = cycle.cycle === 'vip';
  const hasTasks = cycle.taskTotal > 0;
  const hasBosses = cycle.bossTotal > 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[3px]">
      <span className="sr-only">{label.full}</span>
      <svg viewBox="0 0 44 44" aria-hidden="true" className="h-auto w-full max-w-14">
        {hasTasks && (
          <RingArc radius={OUTER_RADIUS} done={cycle.taskDone} total={cycle.taskTotal} arcClassName="stroke-ring" />
        )}
        {hasBosses && (
          <RingArc
            radius={isVip ? OUTER_RADIUS : INNER_RADIUS}
            done={cycle.bossDone}
            total={cycle.bossTotal}
            arcClassName="stroke-boss-foreground"
          />
        )}
        <text
          x={CENTER}
          y={25}
          textAnchor="middle"
          fontSize={isVip ? 8.5 : 10}
          fontWeight={700}
          className="fill-foreground"
        >
          {label.short}
        </text>
      </svg>
      {/* 固定保留兩行高度:只有一行文字的環也不會讓下方的收益列上下跳動 */}
      <div className="flex min-h-[27px] flex-col items-center gap-px text-[10.5px] leading-[1.3] tabular-nums">
        {hasTasks && (
          <span className="font-bold text-ring">
            任務 {cycle.taskDone}/{cycle.taskTotal}
          </span>
        )}
        {hasBosses && (
          <span className="font-bold text-boss-foreground">
            BOSS {cycle.bossDone}/{cycle.bossTotal}
          </span>
        )}
      </div>
    </div>
  );
}
