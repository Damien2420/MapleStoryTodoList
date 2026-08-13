import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GithubIcon } from '@/components/ui/github';
import { CHANGELOG } from '@/lib/changelog';

const GITHUB_REPO_URL = 'https://github.com/Damien2420/MapleStoryTodoList';

/** 全站頁尾:提供版本更新紀錄 Dialog 入口與 GitHub 專案連結 */
export function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="mt-auto flex items-center justify-center gap-1 border-t border-border px-4 py-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground">
            版本紀錄
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>版本更新紀錄</DialogTitle>
            <DialogDescription>楓之谷角色任務追蹤管理的歷史版本變更內容。</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">v{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground"
        aria-label="前往 GitHub 專案頁面"
        asChild
      >
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <GithubIcon size={16} />
        </a>
      </Button>
    </footer>
  );
}