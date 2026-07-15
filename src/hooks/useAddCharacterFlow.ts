import { useState } from 'react';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import type { PresetTask } from '@/lib/presetTasks';
import type { BossSelection } from '@/lib/bossCatalog';
import { SERVERS, type Server } from '@/lib/servers';
import { fetchCharacterByName, isKnownServer } from '@/lib/nexon';
import { CHARACTER_NAME_MAX_LENGTH, type BossDifficulty } from '@/types';

type AddCharacterStep = 'info' | 'presets' | 'bosses' | 'confirm';
type LookupPhase = 'search' | 'result' | 'form';

/**
 * 「新增角色」共用流程:NEXON API 查詢/手動輸入角色資訊 → 套用預設任務 → 套用預設 BOSS → 確認建立。
 * 供 CharacterTabs(Dialog 入口)與 FirstCharacterOnboarding(首次引導畫面入口)共用,
 * 兩者只負責各自的外層 UI,狀態與邏輯全部集中在這裡維護一份。
 *
 * @param onCreated 角色建立成功後的收尾動作(例如 Dialog 入口需要額外關閉彈窗),可省略。
 */
export function useAddCharacterFlow(onCreated?: () => void) {
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const addPresetTasks = useTaskStore((s) => s.addPresetTasks);
  const addBosses = useBossStore((s) => s.addBosses);

  const [step, setStep] = useState<AddCharacterStep>('info');
  const [lookupPhase, setLookupPhase] = useState<LookupPhase>('search');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [level, setLevel] = useState('');
  const [job, setJob] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [resolvedPresetTasks, setResolvedPresetTasks] = useState<PresetTask[]>([]);
  const [bossSelections, setBossSelections] = useState<Map<string, Set<BossDifficulty>>>(new Map());
  const [resolvedBossSelections, setResolvedBossSelections] = useState<BossSelection[]>([]);

  function togglePreset(id: string) {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleBossDifficulty(bossId: string, difficulty: BossDifficulty) {
    setBossSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(bossId));
      if (set.has(difficulty)) set.delete(difficulty);
      else set.add(difficulty);
      if (set.size === 0) next.delete(bossId);
      else next.set(bossId, set);
      return next;
    });
  }

  function resetForm() {
    setStep('info');
    setLookupPhase('search');
    setLookupLoading(false);
    setLookupError(undefined);
    setName('');
    setServer(SERVERS[0]);
    setLevel('');
    setJob(undefined);
    setImageUrl(undefined);
    setSelectedPresetIds(new Set());
    setResolvedPresetTasks([]);
    setBossSelections(new Map());
    setResolvedBossSelections([]);
  }

  const canSubmit = name.trim().length > 0 && name.length <= CHARACTER_NAME_MAX_LENGTH && !!job;
  const enteredLevel = Number(level) || 1;

  async function handleLookup(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLookupLoading(true);
    setLookupError(undefined);
    try {
      const info = await fetchCharacterByName(trimmed);
      if (!isKnownServer(info.world)) {
        setLookupError('查詢結果的伺服器無法辨識,請改用手動輸入');
        return;
      }
      setName(info.name);
      setServer(info.world);
      setLevel(String(info.level));
      setJob(info.job);
      setImageUrl(info.imageUrl);
      setLookupPhase('result');
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : '查詢角色時發生未預期的錯誤');
    } finally {
      setLookupLoading(false);
    }
  }

  function switchToManualEntry() {
    setLookupError(undefined);
    setLookupPhase('form');
  }

  function retryLookup() {
    setLookupError(undefined);
    setJob(undefined);
    setImageUrl(undefined);
    setLookupPhase('search');
  }

  function confirmLookupResult() {
    setStep('presets');
  }

  function handleInfoSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep('presets');
  }

  function continueFromPresets(tasks: PresetTask[]) {
    setResolvedPresetTasks(tasks);
    setStep('bosses');
  }

  function continueFromBosses(selections: BossSelection[]) {
    setResolvedBossSelections(selections);
    setStep('confirm');
  }

  function createCharacter(tasks: PresetTask[], bosses: BossSelection[]) {
    if (!canSubmit) return;
    const newCharacterId = addCharacter({ name, server, level: enteredLevel, job: job!, imageUrl });
    if (tasks.length > 0) {
      addPresetTasks(newCharacterId, tasks);
    }
    if (bosses.length > 0) {
      addBosses(newCharacterId, bosses);
    }
    resetForm();
    onCreated?.();
  }

  return {
    step,
    setStep,
    lookupPhase,
    setLookupPhase,
    lookupLoading,
    lookupError,
    name,
    setName,
    server,
    setServer,
    level,
    setLevel,
    job,
    setJob,
    imageUrl,
    selectedPresetIds,
    resolvedPresetTasks,
    bossSelections,
    resolvedBossSelections,
    canSubmit,
    enteredLevel,
    togglePreset,
    toggleBossDifficulty,
    resetForm,
    handleLookup,
    switchToManualEntry,
    retryLookup,
    confirmLookupResult,
    handleInfoSubmit,
    continueFromPresets,
    continueFromBosses,
    createCharacter,
  };
}
