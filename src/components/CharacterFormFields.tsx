import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobPickerDialog } from '@/components/JobPickerDialog';
import { CHARACTER_NAME_MAX_LENGTH } from '@/types';
import { SERVERS, type Server } from '@/lib/servers';

interface CharacterFormFieldsProps {
  idPrefix: string;
  name: string;
  onNameChange: (name: string) => void;
  server: Server;
  onServerChange: (server: Server) => void;
  level: string;
  onLevelChange: (level: string) => void;
  job: string | undefined;
  onJobChange: (job: string | undefined) => void;
  autoFocusName?: boolean;
}

/** 建立角色共用欄位:角色名稱、伺服器(下拉式列表)、等級、職業 */
export function CharacterFormFields({
  idPrefix,
  name,
  onNameChange,
  server,
  onServerChange,
  level,
  onLevelChange,
  job,
  onJobChange,
  autoFocusName,
}: CharacterFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>角色名稱</Label>
        <Input
          id={`${idPrefix}-name`}
          autoFocus={autoFocusName}
          placeholder="角色名稱,例如:主號、代練一號"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        {name.length > CHARACTER_NAME_MAX_LENGTH && (
          <p className="text-xs text-destructive">角色名稱最多 {CHARACTER_NAME_MAX_LENGTH} 字</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-server`}>伺服器</Label>
          <Select value={server} onValueChange={(v) => onServerChange(v as Server)}>
            <SelectTrigger id={`${idPrefix}-server`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-level`}>等級</Label>
          <Input
            id={`${idPrefix}-level`}
            type="number"
            min={1}
            max={300}
            placeholder="例如:260"
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          職業<span className="text-destructive"> *</span>
        </Label>
        <JobPickerDialog job={job} onChange={onJobChange} />
      </div>
    </div>
  );
}
