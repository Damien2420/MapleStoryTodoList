import { useCallback, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CharacterTabs } from '@/components/CharacterTabs';
import { CharacterHeader } from '@/components/CharacterHeader';
import { TaskList } from '@/components/TaskList';
import { BossList } from '@/components/BossList';
import { BackupStatusBar } from '@/components/BackupStatusBar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { scrollToCycle, type JumpList } from '@/lib/listJump';
import { matchesMedia, WIDE_LIST_LAYOUT_QUERY } from '@/lib/media';
import { ROUTES } from '@/lib/routes';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { BossCycleKey } from '@/store/useListFilterStore';
import { useActiveCharacter } from '@/hooks/useActiveCharacter';

/** 角色頁(路由 /character):角色分頁列、角色摘要、備份狀態列,以及任務/BOSS 清單;顯示哪隻角色由 useCharacterStore 的 activeCharacterId 決定 */
export function CharacterPage() {
  const activeCharacter = useActiveCharacter();
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);
  // 清單分頁改成受控:跳轉磚在窄螢幕要能切到目標清單
  const [listTab, setListTab] = useState<'tasks' | 'bosses'>('tasks');

  const handleJump = useCallback((cycle: BossCycleKey, lists: JumpList[]) => {
    if (matchesMedia(WIDE_LIST_LAYOUT_QUERY)) {
      // 寬螢幕兩欄並排、各自有捲動容器,兩欄各自捲到該週期
      lists.forEach((list) => scrollToCycle(document, list, cycle, 'container'));
      return;
    }
    const list = lists[0];
    if (!list) return;
    setListTab(list === 'task' ? 'tasks' : 'bosses');
    // 目標分頁原本是 hidden,等切換後的畫面更新再捲動整頁
    requestAnimationFrame(() => scrollToCycle(document, list, cycle, 'page'));
  }, []);

  // CharacterGuard 已擋掉沒有角色的情況,這裡只是收斂型別
  if (!activeCharacter) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <Tabs value={activeCharacter.id} onValueChange={setActiveCharacter} className="contents">
        {/* 分頁只列同帳號的角色,左側是回總覽的入口;底線畫在外層,讓返回連結與分頁共用同一條基線 */}
        <div className="flex items-stretch gap-1 border-b border-border">
          <Link
            to={ROUTES.root}
            aria-label="回到總覽"
            className="-ml-2 flex shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            總覽
          </Link>
          <span aria-hidden="true" className="my-2.5 w-px shrink-0 bg-border" />
          <CharacterTabs />
        </div>
        <TabsContent value={activeCharacter.id} id={`character-panel-${activeCharacter.id}`} className="contents">
          <CharacterHeader character={activeCharacter} onJump={handleJump} />
          <BackupStatusBar />
          <Tabs value={listTab} onValueChange={(value) => setListTab(value as 'tasks' | 'bosses')} className="gap-4">
            <TabsList className="mx-auto lg:hidden" aria-label="清單類型切換">
              <TabsTrigger value="tasks">任務清單</TabsTrigger>
              <TabsTrigger value="bosses">BOSS 清單</TabsTrigger>
            </TabsList>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TabsContent value="tasks" forceMount className="mt-0 hidden data-[state=active]:block lg:block">
                <TaskList character={activeCharacter} />
              </TabsContent>
              <TabsContent value="bosses" forceMount className="mt-0 hidden data-[state=active]:block lg:block">
                <BossList character={activeCharacter} />
              </TabsContent>
            </div>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
