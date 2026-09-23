import type { Character } from '@/types';

/** 一個容器(某個帳號,或 accountId 為 null 的未歸類)與其中依顯示順序排列的角色 id */
export interface CharacterContainer {
  accountId: string | null;
  characterIds: string[];
}

/**
 * 依照容器配置更新角色的帳號歸屬與顯示順序。
 *
 * 角色會依照 `containers` 中出現的順序排列，並重用已放入容器角色原本的 `order` 值。
 * 未出現在任何容器中的角色會維持不變；不存在的角色 ID 會被忽略，重複的角色 ID 只採用第一次出現的位置。
 * 此函式不會修改傳入的陣列。
 *
 * @param characters 套用配置前的所有角色。
 * @param containers 定義角色目標帳號與相對順序的容器。
 * @returns 已更新放入容器角色 `accountId` 與 `order` 的角色陣列。
 */
export function applyCharacterLayout(characters: Character[], containers: CharacterContainer[]): Character[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  // 根據 container 內的順序暫存角色的擺放結果
  const placements: { character: Character; accountId: string | null }[] = [];
  const seen = new Set<string>();
  for (const container of containers) {
    for (const id of container.characterIds) {
      const character = byId.get(id);
      if (!character || seen.has(id)) continue;
      seen.add(id);
      placements.push({ character, accountId: container.accountId });
    }
  }

  const slots = placements.map((p) => p.character.order).sort((a, b) => a - b);
  const updates = new Map<string, Character>();
  // 將每個角色依照 slots 的 order 值得順序加入 updates 內 ( 排序 )
  placements.forEach((placement, index) => {
    updates.set(placement.character.id, { ...placement.character, accountId: placement.accountId, order: slots[index] });
  });

  return characters.map((c) => updates.get(c.id) ?? c);
}

/**
 * 管理帳號彈窗拖曳時用的「容器對照表」:key 是容器 id(帳號 id 或未歸類 id),value 是該容器內依序排列的角色 id。
 * 找出某個角色目前在哪個容器。
 * @returns 容器 id;找不到回傳 undefined
 */
export function findCharacterContainer(containers: Record<string, string[]>, characterId: string): string | undefined {
  return Object.keys(containers).find((key) => containers[key].includes(characterId));
}

/**
 * 把一隻角色移到指定容器的指定位置,回傳新的對照表(不改動傳入的物件)。
 * 拖曳跨容器與同容器內排序共用這個函式:同容器時等於在容器內重新排位置。
 * @param containers 目前的容器對照表
 * @param characterId 被拖曳的角色
 * @param toContainerId 目標容器
 * @param overCharacterId 放在哪隻角色「上面」;null 代表放到容器最後面(例如拖到空容器或容器本身)
 */
export function moveCharacterInContainers(
  containers: Record<string, string[]>,
  characterId: string,
  toContainerId: string,
  overCharacterId: string | null,
): Record<string, string[]> {
  const fromContainerId = findCharacterContainer(containers, characterId);
  if (fromContainerId === undefined || !(toContainerId in containers)) return containers;

  const next: Record<string, string[]> = {};
  for (const key of Object.keys(containers)) {
    next[key] = containers[key].filter((id) => id !== characterId);
  }

  const targetContainer = next[toContainerId];
  const overIndex = overCharacterId === null ? -1 : targetContainer.indexOf(overCharacterId);
  if (overIndex === -1) {
    targetContainer.push(characterId);
  } else {
    // 同容器往後拖(原位置在 over 之前)要放在 over 的後面,往前拖則放在前面,拖曳感才符合直覺
    const originalIndexInSameContainer =
      fromContainerId === toContainerId ? containers[fromContainerId].indexOf(characterId) : -1;
    const originalOverIndex = containers[toContainerId].indexOf(overCharacterId as string);
    const movingDown = originalIndexInSameContainer !== -1 && originalIndexInSameContainer < originalOverIndex;
    targetContainer.splice(movingDown ? overIndex + 1 : overIndex, 0, characterId);
  }
  return next;
}
