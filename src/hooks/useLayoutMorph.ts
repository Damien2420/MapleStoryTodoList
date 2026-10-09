import { useCallback, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/media';

/** ease-out-quart:自然減速,不用彈跳 */
const EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';
const EXPAND_MS = 280;
/** 收合約為展開的 75%,離開的動作比進入快 */
const COLLAPSE_MS = 210;
const MORPH_KEYS = ['avatar', 'name'] as const;

interface MorphSnapshot {
  height: number;
  layerClone: HTMLElement;
  rects: Map<string, DOMRect>;
  duration: number;
}

/**
 * 找出新排版中要淡入的元素:不包含形變元素的子元素整塊淡入;包含形變元素的容器則往內找,
 * 避免容器淡入時把正在移動的立繪/名稱一起淡掉。
 * @param root 排版根元素
 * @returns 要淡入的元素
 */
export function collectFadeTargets(root: Element): Element[] {
  const targets: Element[] = [];
  for (const child of Array.from(root.children)) {
    if (child.hasAttribute('data-morph')) continue;
    if (child.querySelector('[data-morph]')) targets.push(...collectFadeTargets(child));
    else targets.push(child);
  }
  return targets;
}

/**
 * 展開/收合兩種排版切換時的過場動畫(身分區連續變形):
 * 外框高度平滑過渡;立繪與名稱從舊位置/大小移動縮放到新位置(FLIP,只用 transform);
 * 舊排版的靜態複本疊在上方淡出,新排版其餘內容延遲淡入。
 * 減少動態效果或環境不支援 Web Animations 時直接切換。
 * @param stateKey 目前的排版狀態;值改變且事先呼叫過 capture() 時,在畫面更新後播放動畫
 * @returns shellRef 綁在外框元素上;capture(direction) 要在切換狀態前呼叫,回傳 false 代表動畫進行中、這次切換應忽略
 */
export function useLayoutMorph(stateKey: unknown) {
  const shellRef = useRef<HTMLDivElement>(null);
  const pending = useRef<MorphSnapshot | null>(null);
  const busy = useRef(false);

  const capture = useCallback((direction: 'expand' | 'collapse') => {
    if (busy.current) return false;
    const shell = shellRef.current;
    const layer = shell?.querySelector<HTMLElement>('[data-morph-layer]');
    if (!shell || !layer || prefersReducedMotion() || typeof shell.animate !== 'function') return true;

    const rects = new Map<string, DOMRect>();
    for (const key of MORPH_KEYS) {
      const el = layer.querySelector(`[data-morph="${key}"]`);
      if (el) rects.set(key, el.getBoundingClientRect());
    }
    pending.current = {
      height: shell.getBoundingClientRect().height,
      layerClone: layer.cloneNode(true) as HTMLElement,
      rects,
      duration: direction === 'expand' ? EXPAND_MS : COLLAPSE_MS,
    };
    return true;
  }, []);

  useLayoutEffect(() => {
    const snapshot = pending.current;
    const shell = shellRef.current;
    const layer = shell?.querySelector<HTMLElement>('[data-morph-layer]');
    if (!snapshot || !shell || !layer) return;

    busy.current = true;
    const d = snapshot.duration;
    const toHeight = shell.getBoundingClientRect().height;

    // 舊排版的靜態複本疊在上方淡出;形變元素在複本裡先藏起來,由新排版的同一元素接手
    const clone = snapshot.layerClone;
    clone.removeAttribute('data-morph-layer');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    Object.assign(clone.style, { position: 'absolute', top: '0', left: '0', right: '0', pointerEvents: 'none' });
    clone.querySelectorAll<HTMLElement>('[data-morph]').forEach((el) => {
      el.style.opacity = '0';
    });
    shell.appendChild(clone);

    const animations: Animation[] = [
      shell.animate([{ height: `${snapshot.height}px` }, { height: `${toHeight}px` }], { duration: d, easing: EASE }),
      clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.45, fill: 'forwards' }),
    ];
    for (const [key, from] of snapshot.rects) {
      const el = layer.querySelector<HTMLElement>(`[data-morph="${key}"]`);
      if (!el) continue;
      const to = el.getBoundingClientRect();
      if (to.height === 0) continue;
      animations.push(
        el.animate(
          [
            {
              transformOrigin: 'top left',
              transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.height / to.height})`,
            },
            { transformOrigin: 'top left', transform: 'none' },
          ],
          { duration: d, easing: EASE },
        ),
      );
    }
    for (const el of collectFadeTargets(layer)) {
      animations.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.65, delay: d * 0.35, fill: 'backwards' }),
      );
    }

    let done = false;
    const teardown = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      animations.forEach((a) => a.cancel());
      clone.remove();
      busy.current = false;
    };
    // 正常播完才清掉快照;被 effect cleanup 中斷(例如開發模式的 StrictMode 重跑)時保留快照,讓重跑的 effect 從頭播放
    const complete = () => {
      pending.current = null;
      teardown();
    };
    // 分頁在背景時動畫時間軸會暫停,用計時器保底,確保狀態一定會收尾
    const timer = window.setTimeout(complete, d * 1.6 + 100);
    Promise.all(animations.map((a) => a.finished)).then(complete, complete);

    return teardown;
  }, [stateKey]);

  return { shellRef, capture };
}
