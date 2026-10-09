import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useDeleteCharacter } from '@/hooks/useDeleteCharacter';
import { setBeforeMajorDelete } from '@/lib/sync/beforeDelete';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Character } from '@/types';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  setBeforeMajorDelete(undefined);
  useCharacterStore.setState({ characters: [], activeCharacterId: null });
});

function Harness({ onReady }: { onReady: (deleteCharacter: (id: string) => void) => void }) {
  const deleteCharacter = useDeleteCharacter();
  useEffect(() => onReady(deleteCharacter), [deleteCharacter, onReady]);
  return null;
}

describe('useDeleteCharacter', () => {
  it('刪除前先呼叫 beforeMajorDelete，當下角色仍然存在', () => {
    useCharacterStore.setState({ characters: [{ id: 'c1', name: '角色' } as Character], activeCharacterId: 'c1' });
    const seen: string[][] = [];
    setBeforeMajorDelete(() => seen.push(useCharacterStore.getState().characters.map((c) => c.id)));
    let deleteCharacter: ((id: string) => void) | undefined;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harness onReady={(fn) => (deleteCharacter = fn)} />));
    act(() => deleteCharacter!('c1'));

    expect(seen).toEqual([['c1']]);
    expect(useCharacterStore.getState().characters).toEqual([]);
  });
});
