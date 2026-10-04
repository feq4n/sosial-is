import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { addNote, listNotes, removeNote } from '@/services/personal';
import { TimetableGrid } from '@/components/TimetableGrid';
import { ButtonLink, Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, SelectField, TextField } from '@/components/ui';
import { dayFromJsDate, dayHeading, findGroup, lessonsOfGroup, shiftLabel, specialtyLabel, timetableDays } from '@/data/timetable';
import { friendlyError } from '@/utils/errors';

export default function PersonalSchedule() {
  useSeo('Şəxsi cədvəl', undefined, { noindex: true });
  const { user, profile } = useAuth();
  const toast = useToast();
  const notes = useAsync(() => (user ? listNotes(user.uid) : Promise.resolve([])), [user?.uid]);
  const group = findGroup(profile?.group);
  const lessons = lessonsOfGroup(group?.code);
  const today = dayFromJsDate(new Date().getDay());
  const [text, setText] = useState('');
  const [day, setDay] = useState(today ?? 1);
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setFieldErr('Qeydi yazın');
    if (t.length > 500) return setFieldErr('Qeyd ən çox 500 simvol ola bilər');
    if (!user) return;
    setFieldErr(''); setBusy(true);
    try { await addNote(user.uid, t, day); setText(''); notes.reload(); toast.success('Qeyd əlavə olundu'); }
    catch (er) { toast.error(friendlyError(er)); } finally { setBusy(false); }
  };
  const del = async (id: string) => {
    if (!user) return;
    try { await removeNote(user.uid, id); notes.reload(); } catch (er) { toast.error(friendlyError(er)); }
  };

  const noteDays = [...new Set((notes.data ?? []).map((n) => n.day).filter((d) => d > 5))].sort();
  const days = [1, 2, 3, 4, 5, ...noteDays];

  return (
    <>
      <PageHeader title="Şəxsi cədvəl" text="Qrupunuzun həftəlik dərsləri və günlərə bağlı şəxsi qeydləriniz." />
      <Card className="mb-6 p-5">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
          <TextField label="Yeni qeyd" value={text} onChange={(e) => setText(e.target.value)} placeholder="Məs.: seminar üçün referat" error={fieldErr} />
          <SelectField label="Gün" value={day} onChange={(e) => setDay(Number(e.target.value))}>{timetableDays.map((d) => <option key={d.no} value={d.no}>{dayHeading(d.no)}</option>)}</SelectField>
          <Button type="submit" loading={busy} className="sm:mb-0">Əlavə et</Button>
        </form>
      </Card>
      {group ? (
        <p className="mb-4 text-sm text-muted">Qrup: <strong className="text-ink">{group.code}</strong> · {specialtyLabel(group.specialty)} · Kurs: {group.course} · {shiftLabel(group.shift)}</p>
      ) : (
        <Card className="mb-6 p-2"><EmptyState title="Qrupunuz seçilməyib" text="Şəxsi dərs cədvəlinizin görünməsi üçün profilinizdə ixtisas və qrupu seçin." action={<ButtonLink to="/dashboard/profile" size="sm">Profilə keç</ButtonLink>} /></Card>
      )}
      {notes.loading ? <ListSkeleton rows={3} /> : notes.error ? <ErrorState message={notes.error} onRetry={notes.reload} /> :
        lessons.length || notes.data?.length ? (
          <TimetableGrid lessons={lessons} days={days} today={today} idPrefix="personal" notes={(d) => {
            const list = (notes.data ?? []).filter((n) => n.day === d);
            return list.length ? (
              <ul className="mt-3 grid gap-2 border-t border-line pt-3" aria-label="Şəxsi qeydlər">
                {list.map((n) => <li key={n.id} className="flex items-start gap-2 rounded-xl bg-accent-soft p-2.5 text-sm text-accent-ink dark:text-accent"><span className="min-w-0 flex-1 break-words">{n.text}</span><button onClick={() => del(n.id)} aria-label="Qeydi sil" className="rounded p-1 hover:bg-black/10"><Trash2 className="size-4" /></button></li>)}
              </ul>
            ) : null;
          }} />
        ) : group ? <EmptyState title="Qrup üçün cədvəl tapılmadı" text="Yuxarıdakı formdan qeyd əlavə edə bilərsiniz." /> : null}
    </>
  );
}
