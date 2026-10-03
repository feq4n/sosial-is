import { SelectField } from '@/components/ui';
import { findGroup, groupsOfSpecialty, shiftLabel, specialtyLabel, specialties } from '@/data/timetable';

export interface Placement { specialty: string; group: string }
export interface PlacementErrors { specialty?: string; group?: string }

export const validatePlacement = (v: Placement): PlacementErrors => ({
  specialty: v.specialty ? undefined : 'İxtisası seçin',
  group: v.group ? undefined : v.specialty ? 'Qrupu seçin' : undefined,
});

export const hasPlacementErrors = (e: PlacementErrors) => Boolean(e.specialty || e.group);

export function PlacementFields({ value, onChange, errors }: { value: Placement; onChange: (v: Placement) => void; errors?: PlacementErrors }) {
  const options = value.specialty ? groupsOfSpecialty(value.specialty) : [];
  const g = findGroup(value.group);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="İxtisas" value={value.specialty} error={errors?.specialty} onChange={(e) => onChange({ specialty: e.target.value, group: '' })}>
          <option value="">İxtisası seçin</option>
          {specialties.map((s) => <option key={s.code} value={s.code}>{specialtyLabel(s.code)}</option>)}
        </SelectField>
        <SelectField label="Qrup" value={value.group} disabled={!value.specialty} error={errors?.group} onChange={(e) => onChange({ specialty: value.specialty, group: e.target.value })}>
          <option value="">{value.specialty ? 'Qrupu seçin' : 'Əvvəlcə ixtisası seçin'}</option>
          {options.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}
        </SelectField>
      </div>
      {g && <p className="text-sm text-muted">Kurs: <strong className="text-ink">{g.course}</strong> · <strong className="text-ink">{shiftLabel(g.shift)}</strong></p>}
    </>
  );
}
