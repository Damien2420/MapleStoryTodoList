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
import { JOB_GROUPS, type JobGroup } from '@/types';

interface JobPickerDialogProps {
  jobGroup: JobGroup | undefined;
  job: string | undefined;
  onChange: (jobGroup: JobGroup | undefined, job: string | undefined) => void;
}

/** 職業選擇彈跳視窗:先選職業群,再從該職業群底下選擇具體職業 */
export function JobPickerDialog({ jobGroup, job, onChange }: JobPickerDialogProps) {
  const [open, setOpen] = useState(false);

  const jobsInGroup = JOB_GROUPS.find((g) => g.group === jobGroup)?.jobs ?? [];

  function handleGroupChange(nextGroup: string) {
    onChange(nextGroup as JobGroup, undefined);
  }

  function handleJobChange(nextJob: string) {
    onChange(jobGroup, nextJob);
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
