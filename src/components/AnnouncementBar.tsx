import { useEffect, useState, type MouseEvent } from 'react';
import { ChevronDown, Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'maplestory-todolist:dismissed-announcements';
const CYCLE_INTERVAL_MS = 5000;
const FADE_DURATION_MS = 300;

/**
 * 讀取 public/announcements.json 顯示的更新公告列。
 * 每次只靜態顯示一則,定時淡入淡出切換到下一則;可手動關閉,關閉狀態記錄在
 * localStorage,只要 announcements.json 內容改變(部署新公告)就會重新出現。
 */
export function AnnouncementBar() {
  const [messages, setMessages] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/announcements.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
          : [];
        setMessages(list);

        const signature = JSON.stringify(list);
        setDismissed(list.length === 0 || localStorage.getItem(DISMISSED_KEY) === signature);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!messages || messages.length <= 1 || expanded) return;

    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, FADE_DURATION_MS);
    }, CYCLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [messages, expanded]);

  if (!messages || messages.length === 0 || dismissed) return null;

  function dismiss(e: MouseEvent) {
    e.stopPropagation();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(messages));
    setDismissed(true);
  }

  return (
    <div className="relative flex items-center justify-center gap-1.5 bg-secondary px-10 py-1.5 text-sm text-secondary-foreground sm:px-12">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex min-w-0 cursor-pointer items-center gap-1.5 rounded text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:cursor-default',
          expanded && 'items-start',
        )}
      >
        <Megaphone aria-hidden className={cn('size-3.5 shrink-0', expanded && 'mt-[3px]')} />
        <span
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            'min-w-0 transition-opacity',
            expanded ? 'whitespace-normal break-words sm:truncate' : 'truncate',
            visible ? 'opacity-100' : 'opacity-0',
          )}
          style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        >
          {messages[index]}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? '收合公告' : '展開公告'}
        tabIndex={-1}
        className="absolute left-1/2 top-full flex -translate-x-1/2 items-center justify-center p-2 outline-none sm:hidden"
      >
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉公告"
        className="absolute right-3 top-1 flex size-6 items-center justify-center rounded text-secondary-foreground/70 outline-none transition-colors hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:right-5"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
