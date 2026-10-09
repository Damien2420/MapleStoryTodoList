import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InfoTip, Note } from './parts';
import type { TimelineModel } from './weaponUi';

/**
 * 預估時間軸(桌面與手機共用):節點的日期寫回標題列,不用浮動說明。
 * 軌道切成 44px 高的點擊格,每格延伸到和相鄰節點的中點;桌面滑鼠移入時預覽、點擊固定,手機點擊或按住左右滑動固定;
 * 預覽或固定後,軌道從今天填到該節點
 * @param model 時間軸資料
 * @param desktop 是否為桌面排版(說明用 info 圖示、提示文字不同)
 * @param color 武器的顏色(CSS 色值),軌道、節點與終點文字都用這個顏色,和上方進度條一致
 * @param fullLabel 「查看完整預估」按鈕文字,沒有時不顯示
 * @param onFull 點完整預估按鈕時呼叫
 */
export function EstimateTimeline({
  model,
  desktop,
  color,
  fullLabel,
  onFull,
}: {
  model: TimelineModel;
  desktop: boolean;
  color: string;
  fullLabel?: string;
  onFull?: () => void;
}) {
  const last = model.ticks.length - 1;
  const [picked, setPicked] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const fullButton = fullLabel && onFull && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onFull}
      className="relative -mt-1.5 -mb-1.5 -ml-2 h-8 gap-0.5 self-start px-2 text-xs text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']"
    >
      {fullLabel}
      <ChevronRight aria-hidden="true" />
    </Button>
  );

  if (model.none) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock aria-hidden="true" className="size-3.5" />
            {model.label}
          </span>
          <b className="font-medium text-muted-foreground">無法推算</b>
        </div>
        <div aria-hidden="true" className="mt-2.5 border-t border-dashed border-border" />
        <div className="text-xs text-muted-foreground">清單追蹤相關 BOSS 後，才能推算時間</div>
        {fullButton}
      </div>
    );
  }

  const shown = preview ?? picked ?? last;
  const active = preview !== null || picked !== null;
  const tick = model.ticks[shown];
  // 預覽或固定節點時填到該節點;沒有時,有 progress 的軌道(靈魂)填到目前進度,其他軌道填到預設停的最後一個節點
  const fillTo = active ? tick.position : (model.progress ?? tick.position);
  // 標籤會互相蓋住時略過較近的節點(手機軌道窄,間距門檻比桌面大);終點與目前選到的節點一定顯示
  const minLabelGap = desktop ? 5 : 15;
  const labelShown: boolean[] = [];
  let lastLabelAt = -100;
  for (let i = 0; i < model.ticks.length; i++) {
    const { position } = model.ticks[i];
    const fits = position - lastLabelAt >= minLabelGap && 100 - position >= minLabelGap;
    labelShown.push(i === last || fits);
    if (fits) lastLabelAt = position;
  }
  // 每個點擊格延伸到和相鄰節點的中點
  const cells = model.ticks.map((t, i) => {
    const from = i === 0 ? 0 : (model.ticks[i - 1].position + t.position) / 2;
    const to = i === last ? 100 : (t.position + model.ticks[i + 1].position) / 2;
    return { from, to };
  });
  const cellAt = (clientX: number) => {
    const r = bandRef.current!.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    const i = cells.findIndex((c) => pct < c.to);
    return i === -1 ? last : i;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    scrubbing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPicked(cellAt(e.clientX));
    setPreview(null);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) setPicked(cellAt(e.clientX));
    else if (e.pointerType === 'mouse') setPreview(cellAt(e.clientX));
  };
  const endScrub = () => {
    scrubbing.current = false;
  };

  return (
    <div className="flex flex-col gap-1.5" style={{ '--bar': color } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock aria-hidden="true" className="size-3.5" />
          <span>{tick.head}</span>
          {desktop && <InfoTip text={model.tip} />}
        </span>
        <b aria-live="polite" className="font-semibold tabular-nums">
          {tick.value}
        </b>
      </div>
      <div
        ref={bandRef}
        className="relative -mt-1 h-11 touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={() => !scrubbing.current && setPreview(null)}
      >
        <div className="absolute inset-x-0 bottom-2.5 h-2 rounded-[3px] bg-[color-mix(in_oklab,var(--bar)_22%,var(--card))] before:absolute before:top-1/2 before:left-0 before:z-[1] before:size-2.5 before:translate-x-[-1px] before:-translate-y-1/2 before:rounded-full before:bg-(--bar) before:content-['']">
          <span
            className="pointer-events-none absolute inset-0 rounded-[3px] bg-[color-mix(in_oklab,var(--bar)_60%,var(--card))] transition-[clip-path] duration-[250ms] ease-[var(--ease-smooth-out)] motion-reduce:transition-none"
            style={{ clipPath: `inset(0 ${100 - fillTo}% 0 0 round 3px)` }}
          />
          {model.ticks.map((t, i) => {
            const isEnd = i === last;
            const on = i === shown;
            const hideLabel = !isEnd && !on && !labelShown[i];
            return (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute top-1/2 z-[2] -mt-3 size-6',
                  isEnd ? '-ml-[18px]' : '-ml-3',
                  // 圓點用 ::after 畫,只放大圓點,標籤文字不會被拉伸
                  "after:absolute after:top-1/2 after:left-1/2 after:rounded-full after:bg-(--bar) after:shadow-[0_0_0_2px_var(--popover)] after:transition-transform after:duration-150 after:ease-[var(--ease-smooth-out)] after:content-[''] motion-reduce:after:transition-none",
                  isEnd ? 'after:-mt-1.5 after:-ml-1.5 after:size-3' : 'after:-mt-1 after:-ml-1 after:size-2',
                  on && (isEnd ? 'after:scale-125 motion-reduce:after:scale-100' : 'after:scale-[1.375] motion-reduce:after:scale-100'),
                )}
                style={{ left: `${t.position}%` }}
              >
                {!hideLabel && (
                  <em
                    className={cn(
                      'absolute bottom-[calc(100%-4px)] text-[10.5px] font-semibold whitespace-nowrap not-italic transition-colors duration-150',
                      isEnd ? 'right-1.5 text-(--bar)' : 'left-1/2 -translate-x-1/2',
                      !isEnd && (on ? 'text-foreground' : 'text-muted-foreground'),
                    )}
                  >
                    {t.label}
                  </em>
                )}
              </span>
            );
          })}
        </div>
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === (picked ?? last)}
            aria-label={`${model.ticks[i].head}，預計 ${model.ticks[i].value.replace(' · ', '，')}`}
            className="absolute inset-y-0 z-[3] rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{ left: `${c.from}%`, width: `${c.to - c.from}%` }}
            onFocus={() => setPreview(i)}
            onBlur={() => setPreview(null)}
            onClick={() => {
              setPicked(i);
              setPreview(null);
            }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{model.startLabel ?? '今天'}</span>
        {model.ticks.length > 1 && (
          <span>{desktop ? '指向節點看各階日期，點擊後可固定至該階時間點' : '點節點看各階日期'}</span>
        )}
        <span className="tabular-nums">{model.endLabel}</span>
      </div>
      {!desktop && model.ticks.length > 3 && (
        // 手機的節點間距小,節點 4 個以上時另外提供上一個 / 下一個按鈕(44px 高),不必精準點到小圓點;節點更少時直接點軌道即可
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" className="h-11 flex-1" disabled={(picked ?? last) === 0} onClick={() => setPicked(Math.max(0, (picked ?? last) - 1))}>
            <ChevronLeft aria-hidden="true" />
            上一個節點
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-11 flex-1" disabled={(picked ?? last) === last} onClick={() => setPicked(Math.min(last, (picked ?? last) + 1))}>
            下一個節點
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
      {!desktop && <Note>{model.tip}</Note>}
      {fullButton}
    </div>
  );
}
