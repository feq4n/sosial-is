import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { scheduleApi } from '@/services/content';
import { addNote, listNotes, removeNote } from '@/services/personal';
import { WeekGrid } from '@/pages/public/Schedule';
import { Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, SelectField, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { jsDayToIso, weekdays } from '@/utils/labels';

export default function PersonalSchedule() {
  useSeo('Şəxsi cədvəl', undefined, { noindex: true });
  const { user } = useAuth();
  const toast = useToast();
  const sched = useAsync(() => scheduleApi.list(), []);
  const notes = useAsync(() => (user ? listNotes(user.uid) : Promise.resolve([])), [user?.uid]);
  const today = jsDayToIso(new Date().getDay());
  const [text, setText] = useState('');
  const [day, setDay] = useState(today);
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

  const nextUp = (sched.data ?? []).filter((s) => s.day === today).slice(0, 3);

  return (
    <>
      <PageHeader title="Şəxsi cədvəl" text="Həftəlik dərslər və günlərə bağlı şəxsi qeydləriniz." />
      <Card className="mb-6 p-5">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
          <TextField label="Yeni qeyd" value={text} onChange={(e) => setText(e.target.value)} placeholder="Məs.: seminar üçün referat" error={fieldErr} />
          <SelectField label="Gün" value={day} onChange={(e) => setDay(Number(e.target.value))}>{weekdays.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}</SelectField>
          <Button type="submit" loading={busy} className="sm:mb-0">Əlavə et</Button>
        </form>
      </Card>
      {nextUp.length > 0 && <p className="mb-4 text-sm text-muted">Bu gün: {nextUp.map((s) => `${s.startTime} ${s.subject}`).join(' · ')}</p>}
      {sched.loading || notes.loading ? <ListSkeleton rows={3} /> : sched.error || notes.error ? <ErrorState message={(sched.error ?? notes.error)!} onRetry={() => { sched.reload(); notes.reload(); }} /> :
        sched.data?.length || notes.data?.length ? (
          <WeekGrid entries={sched.data ?? []} today={today} notes={(d) => {
            const list = (notes.data ?? []).filter((n) => n.day === d);
            return list.length ? (
              <ul className="mt-3 grid gap-2 border-t border-line pt-3" aria-label="Şəxsi qeydlər">
                {list.map((n) => <li key={n.id} className="flex items-start gap-2 rounded-xl bg-accent-soft p-2.5 text-sm text-accent-ink dark:text-accent"><span className="min-w-0 flex-1 break-words">{n.text}</span><button onClick={() => del(n.id)} aria-label="Qeydi sil" className="rounded p-1 hover:bg-black/10"><Trash2 className="size-4" /></button></li>)}
              </ul>
            ) : null;
          }} />
        ) : <EmptyState title="Cədvəl və qeyd yoxdur" text="Cədvəl əlavə olunduqda burada görünəcək. Yuxarıdakı formdan qeyd də əlavə edə bilərsiniz." />}
    </>
  );
}
