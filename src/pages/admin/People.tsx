import { useMemo, useState } from 'react';
import { Mail, MailOpen, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { deleteMessage, listMessages, listUsers, markMessageRead, setUserRole } from '@/services/users';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ListSkeleton, Modal, PageHeader, SelectField, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { formatDateTime, matchesQuery } from '@/utils/format';
import { findGroup, shiftLabel, specialtyLabel } from '@/data/timetable';
import { roleLabels } from '@/utils/labels';
import type { ContactMessage, Role, UserProfile } from '@/types';

export function AdminUsers() {
  useSeo('İstifadəçilər (admin)', undefined, { noindex: true });
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => listUsers(), []);
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ u: UserProfile; role: Role } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (data ?? []).filter((u) => (!roleF || u.role === roleF) && matchesQuery(q, u.firstName, u.lastName, u.email, u.group, u.specialty)), [data, q, roleF]);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const cur = Math.min(page, pages);

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try { await setUserRole(pending.u.uid, pending.role); toast.success('Rol yeniləndi'); setPending(null); reload(); }
    catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="İstifadəçilər" text="İstifadəçilərin siyahısı və rolların idarə edilməsi." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]" role="search">
        <div className="relative"><TextField label="Axtarış" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-10" /><Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden /></div>
        <SelectField label="Rol" value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1); }}><option value="">Hamısı</option>{Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField>
      </div>
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? <EmptyState title="İstifadəçi tapılmadı" /> : (
        <Card className="overflow-hidden">
          <div className="scroll-x"><table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">İstifadəçilər</caption>
            <thead className="bg-surface-2 text-muted"><tr><th scope="col" className="px-4 py-3">Ad</th><th scope="col" className="px-4 py-3">E-poçt</th><th scope="col" className="px-4 py-3">İxtisas / qrup / növbə</th><th scope="col" className="px-4 py-3">Rol</th></tr></thead>
            <tbody>{rows.slice((cur - 1) * 10, cur * 10).map((u) => (
              <tr key={u.uid} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{(() => { const g = findGroup(u.group); return g && g.specialty === u.specialty ? `${specialtyLabel(g.specialty)} · ${g.code} · ${shiftLabel(g.shift)}` : '—'; })()}</td>
                <td className="px-4 py-3">
                  {u.isSuperAdmin ? <Badge tone="brand"><ShieldCheck className="size-3" aria-hidden />Super Admin{u.uid === user?.uid ? ' (siz)' : ''}</Badge> : u.uid === user?.uid ? <Badge tone="brand">{roleLabels[u.role]} (siz)</Badge> : (
                    <select aria-label={`${u.firstName} ${u.lastName} üçün rol`} value={u.role} onChange={(e) => setPending({ u, role: e.target.value as Role })} className="rounded-lg border border-line bg-surface px-2 py-1.5">
                      {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>)}
                </td>
              </tr>))}</tbody>
          </table></div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted"><span>{rows.length} istifadəçi</span>
            <div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Əvvəlki</Button><span>{cur} / {pages}</span><Button size="sm" variant="secondary" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Növbəti</Button></div></div>
        </Card>
      )}
      <ConfirmDialog open={!!pending} title="Rol dəyişdirilsin?" confirmLabel="Dəyiş" loading={busy} onConfirm={apply} onClose={() => setPending(null)}
        text={pending ? `${pending.u.firstName} ${pending.u.lastName} üçün rol “${roleLabels[pending.u.role]}” əvəzinə “${roleLabels[pending.role]}” olacaq.` : ''} />
    </>
  );
}

export function AdminMessages() {
  useSeo('Mesajlar (admin)', undefined, { noindex: true });
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => listMessages(), []);
  const [open, setOpen] = useState<ContactMessage | null>(null);
  const [del, setDel] = useState<ContactMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const view = async (m: ContactMessage) => {
    setOpen(m);
    if (m.status === 'new') { try { await markMessageRead(m.id, 'read'); reload(); } catch { /* sakit */ } }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await deleteMessage(del.id); toast.success('Mesaj silindi'); setDel(null); reload(); }
    catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Əlaqə mesajları" text="Əlaqə formasından gələn mesajlar." />
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <EmptyState icon={<Mail className="size-7" aria-hidden />} title="Mesaj yoxdur" text="Əlaqə formasından gələn mesajlar burada görünəcək." /> : (
        <ul className="grid gap-3">{data.map((m) => (
          <li key={m.id}><Card className="flex items-start gap-3 p-4">
            {m.status === 'new' ? <Mail className="mt-1 size-5 shrink-0 text-accent" aria-hidden /> : <MailOpen className="mt-1 size-5 shrink-0 text-muted" aria-hidden />}
            <button className="min-w-0 flex-1 text-left" onClick={() => view(m)}>
              <span className="flex flex-wrap items-center gap-2">{m.status === 'new' && <Badge tone="accent">Yeni</Badge>}<span className="font-bold">{m.subject}</span></span>
              <span className="block truncate text-sm text-muted">{m.name} · {m.email} · {formatDateTime(m.createdAt)}</span>
            </button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDel(m)} aria-label={`Sil: ${m.subject}`}><Trash2 className="size-4" /></Button>
          </Card></li>))}</ul>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ''} wide>
        {open && <><p className="text-sm text-muted">{open.name} · <a className="text-brand hover:underline" href={`mailto:${open.email}`}>{open.email}</a> · {formatDateTime(open.createdAt)}</p><p className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{open.message}</p></>}
      </Modal>
      <ConfirmDialog open={!!del} title="Mesaj silinsin?" text="Bu mesaj həmişəlik silinəcək." loading={busy} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
