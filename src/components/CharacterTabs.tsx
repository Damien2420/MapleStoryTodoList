import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useAccountStore } from '@/store/useAccountStore';
import { useActiveCharacter } from '@/hooks/useActiveCharacter';
import { getSameAccountCharacters } from '@/lib/characterBoard';

/** 角色分頁列:只列出與目前角色同帳號的角色,用來切換目前檢視的角色;跨帳號切換走總覽頁 */
export function CharacterTabs() {
  const allCharacters = useCharacterStore((s) => s.characters);
  const accounts = useAccountStore((s) => s.accounts);
  const activeCharacter = useActiveCharacter();
  const activeCharacterId = activeCharacter?.id;

  // 在元件內用 useMemo 衍生,不寫進 zustand selector(selector 每次回傳新陣列會造成無限重繪)
  const characters = useMemo(() => {
    if (!activeCharacter) return [];
    const accountIds = new Set(accounts.map((a) => a.id));
    return getSameAccountCharacters(allCharacters, activeCharacter, accountIds);
  }, [allCharacters, accounts, activeCharacter]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function updateScrollEdges() {
      if (!track) return;
      setCanScrollLeft(track.scrollLeft > 2);
      setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth - 2);
    }

    function handleWheel(e: WheelEvent) {
      if (!track || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }

    updateScrollEdges();
    track.addEventListener('wheel', handleWheel, { passive: false });
    track.addEventListener('scroll', updateScrollEdges);
    window.addEventListener('resize', updateScrollEdges);
    return () => {
      track.removeEventListener('wheel', handleWheel);
      track.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, [characters.length]);

  function scrollTrackBy(amount: number) {
    trackRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  }

  return (
    <div className="relative min-w-0 flex-1">
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-xl bg-gradient-to-r from-background to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-xl bg-gradient-to-l from-background to-transparent" />
      )}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="向左捲動角色分頁"
          onClick={() => scrollTrackBy(-160)}
          className="absolute top-1/2 left-1 z-20 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="向右捲動角色分頁"
          onClick={() => scrollTrackBy(160)}
          className="absolute top-1/2 right-1 z-20 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronRight className="size-3.5" />
        </button>
      )}

      <div
        ref={trackRef}
        className="flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* line variant = 底線式分頁;底線與選中文字改用金黃(secondary-foreground 深淺主題各自有足夠對比) */}
        <TabsList variant="line" className="contents" aria-label="角色選擇">
          {characters.map((character) => (
            <TabsTrigger
              key={character.id}
              value={character.id}
              // 目前只會渲染「選中角色」對應的那個 TabsContent(其餘角色的內容不會一併掛載),
              // 所以只有選中中的分頁能指到真實存在的 id;其餘分頁不給 aria-controls,避免指向不存在的元素
              aria-controls={character.id === activeCharacterId ? `character-panel-${character.id}` : undefined}
              className="flex-none px-3 py-2 text-sm font-medium transition-colors data-active:font-semibold data-active:text-secondary-foreground after:rounded-full after:bg-secondary-foreground group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[2.5px]"
            >
              {character.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
