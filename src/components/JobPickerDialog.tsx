import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOB_GROUPS, type JobGroup } from '@/lib/jobs';

interface JobPickerDialogProps {
  job: string | undefined;
  onChange: (job: string | undefined) => void;
}

/** 依目前選定的職業反查所屬職業群,查不到(尚未選擇或職業名稱對應不上)回傳 undefined */
function findJobGroup(job: string | undefined): JobGroup | undefined {
  return JOB_GROUPS.find((g) => (g.jobs as readonly string[]).includes(job ?? ''))?.group;
}

/** 職業選擇彈跳視窗:先選職業群,再從該職業群底下選擇具體職業。職業群只是這裡的內部導覽用 state,實際只對外暴露/接收 job */
export function JobPickerDialog({ job, onChange }: JobPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [jobGroup, setJobGroup] = useState<JobGroup | undefined>(() => findJobGroup(job));

  const jobsInGroup = JOB_GROUPS.find((g) => g.group === jobGroup)?.jobs ?? [];

  function handleGroupChange(nextGroup: string) {
    setJobGroup(nextGroup as JobGroup);
    onChange(undefined);
  }

  function handleJobChange(nextJob: string) {
    onChange(nextJob);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          {job ? `${jobGroup} · ${job}` : '選擇職業'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>選擇職業</DialogTitle>
          <DialogDescription>先選擇職業群,再選擇該職業群底下的具體職業。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="job-group">職業群</Label>
            <Select value={jobGroup ?? ''} onValueChange={handleGroupChange}>
              <SelectTrigger id="job-group" className="w-full">
                <SelectValue placeholder="選擇職業群" />
              </SelectTrigger>
              <SelectContent position='popper'>
                {JOB_GROUPS.map(({ group }) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-name">職業</Label>
            <Select value={job ?? ''} onValueChange={handleJobChange} disabled={!jobGroup}>
              <SelectTrigger id="job-name" className="w-full">
                <SelectValue placeholder={jobGroup ? '選擇職業' : '請先選擇職業群'} />
              </SelectTrigger>
              <SelectContent position='popper'>
                {jobsInGroup.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
