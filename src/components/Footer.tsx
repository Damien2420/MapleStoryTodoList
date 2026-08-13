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
import { APP_VERSION, CHANGELOG } from '@/lib/changelog';

/** 全站頁尾:顯示目前版本號,點擊可開啟版本更新紀錄 Dialog */
export function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="mt-auto flex items-center justify-center border-t border-border px-4 py-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground">
            v{APP_VERSION}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
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
    </footer>
  );
}