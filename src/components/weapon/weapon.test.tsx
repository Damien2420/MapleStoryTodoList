import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASTRA, DESTINY, GENESIS } from '@/data/weaponRates.data';
import type { WeaponProgress, WeaponStatusResult } from '@/hooks/useWeaponProgress';
import { at, clear } from '@/lib/weapon/testUtils';
import type { WeaponThisWeek } from '@/lib/weapon/thisWeek';
import { emptyWeaponState, soloKey, UNIT } from '@/lib/weapon/types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EstimateTimeline } from './EstimateTimeline';
import { FullEstimateDialog } from './FullEstimateDialog';
import { SoulLevelUpDialog } from './SoulLevelUpDialog';
import { WeaponSetupDialog } from './WeaponSetupDialog';
import type { Character } from '@/types';
import { ThisWeekCard } from './ThisWeekCard';
import { WeaponEntryPanel } from './WeaponEntryPanel';
import { WeaponStatusView } from './WeaponStatusView';
import { describeWeaponRows, headModel, timelineModel, weaponListRows, type TimelineModel } from './weaponUi';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

/** 桌面版有 InfoTip(Tooltip),需要 TooltipProvider */
function render(node: React.ReactNode) {
  act(() => root!.render(<TooltipProvider>{node}</TooltipProvider>));
}

function button(text: string): HTMLButtonElement {
  return Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text))!;
}

const NO_WEEK: WeaponThisWeek = { rows: [], cycleRows: [], total: 0, shardTotal: 0, capLoss: 0, potential: 0, untracked: false };
const THIS_WEEK = { weapons: { soul: NO_WEEK, genesis: NO_WEEK, destiny: NO_WEEK, astra: NO_WEEK } };

describe('WeaponEntryPanel', () => {
  it('依狀態組出 aria-label:進行中顯示階段、完成、未設定與未解鎖', () => {
    const state = emptyWeaponState();
    state.soul = { ...state.soul, status: 'active', level: 50, pool: 0 };
    state.genesis = { ...state.genesis, status: 'done' };
    const progress: WeaponStatusResult = { state, status: { soul: 'active', genesis: 'done', destiny: 'unset', astra: 'locked' } };
    const onOpen = vi.fn();
    render(<WeaponEntryPanel progress={progress} onOpen={onOpen} />);

    const entry = container!.querySelector('button')!;
    expect(entry.getAttribute('aria-label')).toBe(
      '武器進度：靈魂武器 Lv.50，待升階，創世武器 完成，命運武器 未設定，阿斯特拉輔助武器 尚未解鎖，查看詳情',
    );
    // 畫面上有標題,每條旁邊有階段或狀態文字
    expect(entry.textContent).toContain('武器進度');
    expect(entry.textContent).toContain('Lv.50');
    expect(entry.textContent).toContain('未設定');
    act(() => entry.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('素材已足夠時顯示目前階段並標示待升階', () => {
    const state = emptyWeaponState();
    state.genesis = { status: 'active', stage: 8, pool: 1000 * UNIT };
    const progress: WeaponStatusResult = { state, status: { soul: 'unset', genesis: 'active', destiny: 'locked', astra: 'locked' } };
    render(<WeaponEntryPanel progress={progress} onOpen={() => {}} />);
    const label = container!.querySelector('button')!.getAttribute('aria-label');
    expect(label).toContain('創世武器 第 8 階，待升階');
    expect(container!.textContent).toContain('第 8 階');
  });
});

describe('weaponListRows', () => {
  it('命運第一階段完成時顯示「第一階段」,進度條填滿', () => {
    const state = emptyWeaponState();
    state.genesis = { ...state.genesis, status: 'done' };
    state.destiny = { status: 'phase1done', stage: 3, pool: 0 };
    const progress: WeaponStatusResult = { state, status: { soul: 'unset', genesis: 'done', destiny: 'phase1done', astra: 'unset' } };
    const destiny = weaponListRows(progress).find((r) => r.kind === 'destiny')!;
    expect(destiny).toMatchObject({ label: '第一階段', pct: 100, waiting: false });
    expect(describeWeaponRows(weaponListRows(progress))).toContain('命運武器 第一階段完成');
  });

  // 看板用的 weaponWaiting 和武器視窗的 headModel 是兩份相同的判斷,任一邊改了另一邊沒跟上時要抓到
  it.each([
    { enough: true, name: '足夠' },
    { enough: false, name: '不夠' },
  ])('素材$name時,待升階與 headModel 的判斷一致', ({ enough }) => {
    const state = emptyWeaponState();
    state.soul = { status: 'active', level: enough ? 50 : 45, gatePassed: false, pool: 0, soloCleared: [] };
    state.genesis = { status: 'active', stage: 8, pool: (enough ? GENESIS.needs[7] : 0) * UNIT };
    state.destiny = { status: 'active', stage: 1, pool: (enough ? DESTINY.needs[0] : 0) * UNIT };
    state.astra = { status: 'active', stage: 1, trace: (enough ? ASTRA.traceNeeds[0] : 0) * UNIT, shard: (enough ? ASTRA.shardNeeds[0] : 0) * UNIT };
    const status = { soul: 'active', genesis: 'active', destiny: 'active', astra: 'active' } as const;
    const progress = { state, status, thisWeek: THIS_WEEK } as unknown as WeaponProgress;
    for (const row of weaponListRows({ state, status })) {
      expect(row.waiting, row.kind).toBe(enough);
      expect(row.waiting, row.kind).toBe(headModel(row.kind, progress).waiting);
    }
  });
});

describe('ThisWeekCard', () => {
  it('清單沒有追蹤來源 BOSS 時引導前往 BOSS 清單', () => {
    const onGo = vi.fn();
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, untracked: true }} mobile onGoBossList={onGo} onRates={() => {}} />);
    expect(container!.textContent).toContain('清單中沒有會計入的 BOSS');
    act(() => button('前往 BOSS 清單').click());
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it('本週還沒打時顯示還能取得的量', () => {
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, potential: 1297 * UNIT }} mobile onGoBossList={() => {}} onRates={() => {}} />);
    expect(container!.textContent).toContain('本週還沒有計入的 BOSS');
    expect(container!.textContent).toContain('+1,297');
  });

  it('列出已打的 BOSS、平分人數,並在超過上限時顯示未計入的量', () => {
    const row = {
      clear: clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString(), partySize: 2 }),
      amount: 25 * UNIT,
      split: 2,
      monthly: false,
    };
    render(
      <ThisWeekCard kind="genesis" data={{ ...NO_WEEK, rows: [row], total: 25 * UNIT, capLoss: 100 * UNIT }} mobile onGoBossList={() => {}} onRates={() => {}} />,
    );
    expect(container!.querySelectorAll('li')).toHaveLength(1);
    expect(container!.textContent).toContain('÷2');
    expect(container!.querySelector('[role=note]')!.textContent).toContain('超過上限 3,000，100 痕跡未計入');
  });

  it('VIP 擊破的列加上 VIP 標籤,一般週王不加', () => {
    const rows = [true, false].map((isVip, i) => ({
      clear: clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1, 1 + i).toISOString(), isVip }),
      amount: 10 * UNIT,
      monthly: false,
    }));
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, rows, total: 20 * UNIT }} mobile onGoBossList={() => {}} onRates={() => {}} />);
    const items = container!.querySelectorAll('li');
    expect(items[0].textContent).toContain('VIP');
    expect(items[1].textContent).not.toContain('VIP');
  });

  it('手機超過 4 筆先收合,點「顯示其餘」才展開;沒有內層捲動', () => {
    const rows = ['lotus', 'damien', 'will', 'lucid', 'verus-hilla', 'seren'].map((id, i) => ({
      clear: clear({ bossCatalogId: id, difficulty: '困難', firstClearedAt: at(2026, 10, 1, 1 + i).toISOString() }),
      amount: 10 * UNIT,
      monthly: false,
    }));
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, rows, total: 60 * UNIT }} mobile onGoBossList={() => {}} onRates={() => {}} />);
    expect(container!.querySelectorAll('li')).toHaveLength(4);
    expect(container!.querySelector('ul')!.className).not.toContain('overflow-y-auto');
    act(() => button('顯示其餘 2 隻').click());
    expect(container!.querySelectorAll('li')).toHaveLength(6);
  });

  it('桌面不收合,清單在卡片內捲動', () => {
    const rows = ['lotus', 'damien', 'will', 'lucid', 'verus-hilla', 'seren'].map((id, i) => ({
      clear: clear({ bossCatalogId: id, difficulty: '困難', firstClearedAt: at(2026, 10, 1, 1 + i).toISOString() }),
      amount: 10 * UNIT,
      monthly: false,
    }));
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, rows, total: 60 * UNIT }} mobile={false} onGoBossList={() => {}} onRates={() => {}} />);
    expect(container!.querySelectorAll('li')).toHaveLength(6);
    expect(container!.querySelector('ul')!.className).toContain('overflow-y-auto');
  });

  it('點「各 BOSS 取得量」呼叫 onRates', () => {
    const onRates = vi.fn();
    render(<ThisWeekCard kind="genesis" data={NO_WEEK} mobile onGoBossList={() => {}} onRates={onRates} />);
    act(() => button('各 BOSS 取得量').click());
    expect(onRates).toHaveBeenCalledTimes(1);
  });

  it('有被截掉的量:還在上限時建議先升階;升階後已不在上限,改成說明那些量當時沒有計入', () => {
    const data = { ...NO_WEEK, rows: [{ clear: clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() }), amount: 500 * UNIT, monthly: false }], total: 500 * UNIT, capLoss: 500 * UNIT };
    render(<ThisWeekCard kind="destiny" data={data} mobile destinyCap="3,000" atCap onGoBossList={() => {}} onRates={() => {}} />);
    expect(container!.querySelector('[role=note]')!.textContent).toContain('建議先升階');
    render(<ThisWeekCard kind="destiny" data={data} mobile destinyCap="3,000" atCap={false} onGoBossList={() => {}} onRates={() => {}} />);
    const note = container!.querySelector('[role=note]')!.textContent;
    expect(note).toContain('本週打王時已達上限，500 決心沒有計入');
    expect(note).not.toContain('建議先升階');
  });

  it('沒有被截掉的量時不顯示上限提示', () => {
    render(<ThisWeekCard kind="genesis" data={{ ...NO_WEEK, potential: UNIT }} mobile onGoBossList={() => {}} onRates={() => {}} />);
    expect(container!.querySelector('[role=note]')).toBeNull();
  });
});

const MODEL: TimelineModel = {
  label: '預計解放',
  none: false,
  value: '2027/01/07 · 約 3 個月',
  endLabel: '1/7',
  tip: '說明',
  ticks: [
    { position: 20, label: '2 階', head: '升到 2 階', value: '2026/10/22 · 約 3 週' },
    { position: 100, label: '解放', head: '預計解放', value: '2027/01/07 · 約 3 個月' },
  ],
};

describe('WeaponSetupDialog:靈魂調整進度', () => {
  const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 10, 1, 10).toISOString() });
  const setup = (level: number, cycleRows: WeaponThisWeek['cycleRows'], pool = 0) => {
    const state = emptyWeaponState();
    state.soul = { status: 'active', level, gatePassed: false, pool: pool * UNIT, soloCleared: [] };
    const thisWeek = { weapons: { ...THIS_WEEK.weapons, soul: { ...NO_WEEK, cycleRows } } };
    const progress = { state, thisWeek, profile: { genesisPass: false, stormTraining: false } } as unknown as WeaponProgress;
    const onSave = vi.fn();
    render(
      <WeaponSetupDialog kind="soul" progress={progress} character={{ server: '艾麗亞' } as Character} open onOpenChange={() => {}} onSave={onSave} onComplete={() => {}} />,
    );
    return onSave;
  };
  const bodyButton = (text: string) => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text);
  const title = () => document.body.querySelector('[role="dialog"] h2')?.textContent;

  it('Lv.90 且本週有給靈魂的王:第一步 → 升階任務 → 本週週王,選擇還沒包含時帶上那一隻', () => {
    const onSave = setup(90, [{ clear: lucid, amount: 80 * UNIT, monthly: false }]);
    act(() => bodyButton('下一步')!.click());
    expect(title()).toBe('Lv.90 的升階任務');
    act(() => bodyButton('下一步')!.click());
    expect(title()).toBe('本週打過的週王');
    expect(document.body.textContent).toContain('調整視窗輸入的靈魂碎片');
    act(() => (document.body.querySelector('[role="radio"][value="add"]') as HTMLButtonElement).click());
    act(() => bodyButton('儲存進度')!.click());
    expect(onSave).toHaveBeenCalledWith({
      payload: { weapon: 'soul', level: 90, gatePassed: false, pool: 0, soloCleared: [], autoLevel: true, includeClearIds: [lucid.id] },
    });
  });

  it('自動升級開啟且儲存後會升級:先預覽,最後一步確認才儲存', () => {
    // Lv.85 需要 3,773、Lv.86 需要 4,027,9,000 - 7,800 = 1,200
    const onSave = setup(84, [], 9000);
    expect(document.body.textContent).toContain('儲存後會自動升到 Lv.86，剩 1,200 碎片');
    act(() => bodyButton('下一步')!.click());
    expect(title()).toBe('確認自動升級');
    act(() => bodyButton('儲存進度')!.click());
    expect(onSave.mock.calls[0][0].payload).toMatchObject({ level: 84, pool: 9000, autoLevel: true });
  });

  it('關閉自動升級:照填的值儲存,不需要確認', () => {
    const onSave = setup(84, [], 9000);
    act(() => (document.body.querySelector('#ws-auto') as HTMLButtonElement).click());
    expect(document.body.textContent).toContain('碎片夠升到 Lv.86');
    act(() => bodyButton('儲存進度')!.click());
    expect(onSave.mock.calls[0][0].payload).toMatchObject({ level: 84, autoLevel: false });
  });

  it('預設為已經包含:不帶任何擊破', () => {
    const onSave = setup(84, [{ clear: lucid, amount: 80 * UNIT, monthly: false }]);
    act(() => bodyButton('下一步')!.click());
    expect(title()).toBe('本週打過的週王');
    act(() => bodyButton('儲存進度')!.click());
    expect(onSave.mock.calls[0][0].payload.includeClearIds).toEqual([]);
  });

  it('不在升階關卡、本週也沒有給靈魂的王:第一步直接儲存', () => {
    const onSave = setup(84, []);
    expect(bodyButton('下一步')).toBeUndefined();
    act(() => bodyButton('儲存進度')!.click());
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('SoulLevelUpDialog', () => {
  it('預設升到碎片足夠的最高等級,可以少升幾級', () => {
    const onConfirm = vi.fn();
    const soul = { status: 'active' as const, level: 84, gatePassed: false, pool: 9000 * UNIT, soloCleared: [], autoLevel: false };
    render(<SoulLevelUpDialog soul={soul} open onOpenChange={() => {}} onConfirm={onConfirm} />);
    expect(document.body.textContent).toContain('碎片最多可以升到 Lv.86');
    act(() => document.body.querySelector<HTMLButtonElement>('[aria-label="少升一級"]')!.click());
    expect(document.body.textContent).toContain('共花掉（Lv.84 → 85）3,773');
    // 9,000 - 3,773 = 5,227
    expect(document.body.textContent).toContain('5,227 碎片');
    act(() => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === '確認升級')!.click());
    expect(onConfirm).toHaveBeenCalledWith(85);
  });
});

describe('FullEstimateDialog', () => {
  // jsdom 沒有實作 scrollIntoView:測試裡換成假函式,結束後還原,不影響其他測試
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('開啟時自動捲到目前階段那一列', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const state = emptyWeaponState();
    state.soul = { ...state.soul, status: 'active', level: 84, gatePassed: false, pool: 0 };
    const soulFull = Array.from({ length: 10 }, (_, i) => ({ stage: i + 1, done: i + 1 < 9, date: at(2027, 1, 1), weeks: 8 }));
    const progress = {
      state,
      now: at(2026, 10, 6),
      estimate: { soulFull, destinyFull: [], soulSource: null, gain: { soul: 0, destiny: 0 } },
    } as unknown as WeaponProgress;
    render(<FullEstimateDialog kind="soul" progress={progress} open onOpenChange={() => {}} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).textContent).toMatch(/^9 階/);
  });
});

describe('EstimateTimeline', () => {
  it('預設顯示終點,點擊節點後固定在該節點', () => {
    render(<EstimateTimeline color="var(--weapon-soul)" model={MODEL} desktop={false} />);
    const live = () => container!.querySelector('[aria-live]')!.textContent;
    expect(live()).toBe('2027/01/07 · 約 3 個月');

    const ticks = container!.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    expect(ticks[1].getAttribute('aria-pressed')).toBe('true');
    act(() => ticks[0].click());
    // 點擊會觸發 focus 預覽,失焦後仍停在固定的節點
    act(() => ticks[0].blur());
    expect(ticks[0].getAttribute('aria-pressed')).toBe('true');
    expect(live()).toBe('2026/10/22 · 約 3 週');
  });

  it('手機節點 4 個以上有上一個 / 下一個節點按鈕,桌面與節點較少時沒有', () => {
    const four: TimelineModel = {
      ...MODEL,
      ticks: [
        { position: 10, label: '2 階', head: '升到 2 階', value: '2026/10/15 · 約 2 週' },
        { position: 30, label: '3 階', head: '升到 3 階', value: '2026/10/22 · 約 3 週' },
        { position: 60, label: '4 階', head: '升到 4 階', value: '2026/11/12 · 約 6 週' },
        { position: 100, label: '解放', head: '預計解放', value: '2027/01/07 · 約 3 個月' },
      ],
    };
    render(<EstimateTimeline color="var(--weapon-soul)" model={four} desktop={false} />);
    const live = () => container!.querySelector('[aria-live]')!.textContent;
    expect(button('下一個節點').disabled).toBe(true);
    act(() => button('上一個節點').click());
    expect(live()).toBe('2026/11/12 · 約 6 週');
    act(() => button('上一個節點').click());
    expect(live()).toBe('2026/10/22 · 約 3 週');
    act(() => button('下一個節點').click());
    expect(live()).toBe('2026/11/12 · 約 6 週');
    // 真實畫面換模型時用 key 重新掛載(WeaponDialog),測試也一樣
    render(<EstimateTimeline color="var(--weapon-soul)" key="desktop" model={four} desktop />);
    expect(container!.textContent).not.toContain('上一個節點');
    render(<EstimateTimeline color="var(--weapon-soul)" key="few" model={MODEL} desktop={false} />);
    expect(container!.textContent).not.toContain('上一個節點');
  });

  it('還沒選節點時預設停在最後一個,軌道也填到最後一個節點', () => {
    render(<EstimateTimeline color="var(--weapon-soul)" model={MODEL} desktop={false} />);
    const fill = container!.querySelector<HTMLElement>('span[style*="clip-path"]')!;
    expect(fill.style.clipPath).toContain(`inset(0 ${100 - MODEL.ticks[MODEL.ticks.length - 1].position}%`);
  });

  it('無法推算時不顯示節點', () => {
    render(<EstimateTimeline color="var(--weapon-soul)" model={{ ...MODEL, none: true, ticks: [] }} desktop={false} />);
    expect(container!.textContent).toContain('無法推算');
    expect(container!.querySelectorAll('button[aria-pressed]')).toHaveLength(0);
  });

  it('有完整預估按鈕時點擊呼叫 onFull', () => {
    const onFull = vi.fn();
    render(<EstimateTimeline color="var(--weapon-soul)" model={MODEL} desktop={false} fullLabel="查看完整預估時間軸" onFull={onFull} />);
    act(() => button('查看完整預估時間軸').click());
    expect(onFull).toHaveBeenCalledTimes(1);
  });
});

describe('WeaponStatusView 鎖定', () => {
  const lockedView = (genesisDone: boolean, level: number, onGoGenesis = () => {}) =>
    render(<WeaponStatusView kind="destiny" status="locked" onSetup={() => {}} onStartPhase2={() => {}} unlock={{ genesisDone, level }} onGoGenesis={onGoGenesis} />);

  it('列出兩個解鎖條件各自是否達成,創世還沒完成時可以前往創世', () => {
    const onGo = vi.fn();
    lockedView(false, 285, onGo);
    const items = Array.from(container!.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['完成創世武器的解放尚未達成', '角色達到 Lv.275（目前 Lv.285）已達成']);
    act(() => button('前往創世武器').click());
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it('創世已完成、等級不足時不顯示前往創世', () => {
    lockedView(true, 260);
    const items = Array.from(container!.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['完成創世武器的解放已達成', '角色達到 Lv.275（目前 Lv.260）尚未達成']);
    expect(container!.textContent).not.toContain('前往創世武器');
  });
});

describe('headModel 靈魂右邊的格子', () => {
  const soulProgress = (level: number, soloCleared: string[]) => {
    const state = emptyWeaponState();
    state.soul = { status: 'active', level, gatePassed: false, pool: 1200 * UNIT, soloCleared };
    return { state, thisWeek: THIS_WEEK } as unknown as WeaponProgress;
  };

  it('停在升階關卡、任務還沒完成:請先完成 BOSS 任務進行升階', () => {
    const stat = headModel('soul', soulProgress(50, [])).stats[1];
    expect(stat).toMatchObject({ label: '下一步', value: '請先完成 BOSS 任務進行升階', sub: '' });
  });

  it('停在升階關卡、任務已完成:請先進行升階', () => {
    const stat = headModel('soul', soulProgress(50, [soloKey('lotus', '極限')])).stats[1];
    expect(stat.value).toBe('請先進行升階');
  });

  it('不在升階關卡:照常顯示升到下一級需要的碎片', () => {
    const stat = headModel('soul', soulProgress(45, [])).stats[1];
    expect(stat.label).toBe('升到 Lv.46 需要');
  });
});

describe('headModel 含本週', () => {
  const destinyProgress = (pool: number, total: number, capLoss: number) => {
    const state = emptyWeaponState();
    state.destiny = { status: 'active', stage: 3, pool: pool * UNIT };
    const thisWeek = { weapons: { ...THIS_WEEK.weapons, destiny: { ...NO_WEEK, total: total * UNIT, capLoss: capLoss * UNIT } } };
    return { state, thisWeek } as unknown as WeaponProgress;
  };

  it('只算實際計入持有量的部分:被上限截掉的不算在含本週裡', () => {
    // 升階前已達上限,本週 500 全被截掉;升階扣掉後持有 500,但這 500 不是本週的
    expect(headModel('destiny', destinyProgress(500, 500, 500)).stats[0].sub).toBe('上限 3,000');
    expect(headModel('destiny', destinyProgress(800, 800, 500)).stats[0].sub).toBe('含本週 +300');
  });
});

describe('headModel 阿斯特拉素材格', () => {
  const astraProgress = (trace: number, shard: number) => {
    const state = emptyWeaponState();
    state.astra = { ...state.astra, status: 'active', stage: 1, trace: trace * UNIT, shard: shard * UNIT };
    return { state, thisWeek: THIS_WEEK } as unknown as WeaponProgress;
  };

  it('標籤只放名稱、需求寫在數值旁;達上限優先於已足夠,不夠時顯示還差多少', () => {
    const [trace, shard] = headModel('astra', astraProgress(1000, 815)).stats;
    expect(trace).toMatchObject({ label: '激戰的痕跡', value: '1,000', sub: '/ 600', tone: 'cap', status: '已達上限', fill: 1 });
    expect(shard).toMatchObject({ label: '艾里溫碎片', value: '815', sub: '/ 3,000', status: '還差 2,185' });
    expect(shard.tone).toBeUndefined();
    expect(shard.fill).toBeCloseTo(815 / 3000);
  });

  it('達到需求但未達上限:已足夠', () => {
    const [trace] = headModel('astra', astraProgress(640, 0)).stats;
    expect(trace).toMatchObject({ tone: 'enough', status: '已足夠' });
  });
});

describe('timelineModel 靈魂從今天開始、每級一個節點', () => {
  const gain = { soul: 0, genesis: 0, destiny: 0, astraTrace: 0, astraShard: 0, monthly: { soul: 0, genesis: 0, destiny: 0, astraTrace: 0, astraShard: 0 } };
  /**
   * 預估節點:目前等級的下一級到 end,weeksOf 決定每一級在第幾週達成(預設每週一級)
   * 日期為本週四(10/8)起每週一天,跟 estimate 的節點日期規則一致
   */
  const progress = (level: number, gatePassed = false, end = Math.ceil(level / 10) * 10 + (gatePassed ? 10 : 0), weeksOf = (lv: number) => lv - level) => {
    const state = emptyWeaponState();
    state.soul = { status: 'active', level, gatePassed, pool: 0, soloCleared: [] };
    const nodes = [];
    for (let lv = level + 1; lv <= end; lv++) nodes.push({ label: `Lv.${lv}`, date: at(2026, 10, 3 + 7 * weeksOf(lv)), weeks: weeksOf(lv) });
    return { state, thisWeek: THIS_WEEK, now: at(2026, 10, 3), estimate: { gain, soul: { none: nodes.length === 0, nodes } } } as unknown as WeaponProgress;
  };

  it('停在 Lv.50 還沒升階:整條填滿、終點是待升階,不往下一階推算', () => {
    const m = timelineModel('soul', progress(50));
    expect(m).toMatchObject({ label: '本階段完成', progress: 100, value: '待升階', startLabel: '今天 · Lv.50', endLabel: 'Lv.50 已達成' });
    expect(m.ticks).toEqual([{ position: 100, label: 'Lv.50', head: '本階段完成', value: '待升階' }]);
  });

  it('Lv.46、Lv.47~50 同一週達成:每級各一個節點,日期相同,左端是今天與目前等級', () => {
    const m = timelineModel('soul', progress(46, false, 50, () => 1));
    expect(m.ticks.map((t) => t.label)).toEqual(['Lv.47', 'Lv.48', 'Lv.49', 'Lv.50']);
    expect(m.ticks[3]).toMatchObject({ head: '升到 Lv.50 可升階', position: 100 });
    expect(m.ticks.every((t) => t.value.includes('2026/10/10'))).toBe(true);
    expect(m).toMatchObject({ startLabel: '今天 · Lv.46', endLabel: 'Lv.50 升階 10/10' });
    expect(m.progress).toBeUndefined();
    expect(m.value).toBe(m.ticks[3].value);
  });

  it('Lv.85 每週升一級:每一級各有節點與日期,節點等距排列', () => {
    const m = timelineModel('soul', progress(85));
    expect(m.ticks.map((t) => t.label)).toEqual(['Lv.86', 'Lv.87', 'Lv.88', 'Lv.89', 'Lv.90']);
    expect(m.ticks.map((t) => t.head)).toEqual(['升到 Lv.86', '升到 Lv.87', '升到 Lv.88', '升到 Lv.89', '升到 Lv.90 可升階']);
    expect(m.ticks.map((t) => t.position)).toEqual([20, 40, 60, 80, 100]);
    expect(m.ticks[0].value).toContain('2026/10/10');
    expect(m.ticks[4].value).toContain('2026/11/07');
  });

  it('最後一階的終點是滿等', () => {
    const m = timelineModel('soul', progress(99, false, 100));
    expect(m.ticks[0].head).toBe('滿等 Lv.100');
  });

  it('升階之後(Lv.50 已升階):從今天到 Lv.60', () => {
    const m = timelineModel('soul', progress(50, true));
    expect(m.ticks[m.ticks.length - 1].head).toBe('升到 Lv.60 可升階');
    expect(m.startLabel).toBe('今天 · Lv.50');
    expect(m.progress).toBeUndefined();
  });

  it('不在關卡上又沒有預估節點時無法推算', () => {
    const m = timelineModel('soul', progress(45, false, 45));
    expect(m.none).toBe(true);
  });

  it('停在關卡時軌道一開始就填滿,標題旁顯示待升階,左端是今天與目前等級', () => {
    render(<EstimateTimeline color="var(--weapon-soul)" model={timelineModel('soul', progress(50))} desktop={false} />);
    expect(container!.querySelector('[aria-live]')!.textContent).toBe('待升階');
    expect(container!.innerHTML).toContain('inset(0 0% 0 0');
    expect(container!.textContent).toContain('今天 · Lv.50');
  });

  it('一般情況預設停在最後一個節點、軌道填到該節點,左端是今天與目前等級', () => {
    render(<EstimateTimeline color="var(--weapon-soul)" model={timelineModel('soul', progress(46, false, 50, () => 1))} desktop={false} />);
    expect(container!.innerHTML).toContain('inset(0 0% 0 0');
    expect(container!.textContent).toContain('今天 · Lv.46');
    expect(container!.querySelector('[aria-live]')!.textContent).toContain('2026/10/10');
  });
});
