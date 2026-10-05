import { useMemo } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { useAsync } from '@/hooks/useAsync';
import { useContactInfo } from '@/services/site';
import { teamApi } from '@/services/content';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { StaffMessageForm, type MessageTarget } from '@/components/StaffMessageForm';

export default function Contact() {
  useSeo('Əlaqə', 'Sosial İş şöbəsinin rəsmi əlaqə məlumatları və əməkdaşa mesaj göndərmə.');
  const contact = useContactInfo();
  const { data, loading, error, reload } = useAsync(() => teamApi.list(), []);
  const recipients = useMemo<MessageTarget[]>(
    () => (data ?? []).filter((m) => m.active && m.profileId).map((m) => ({ profileId: String(m.profileId), name: m.fullName, jobTitle: m.jobTitle })),
    [data],
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader title="Əlaqə" text="Şöbənin rəsmi əlaqə məlumatları." />
      <Card className="p-6 sm:p-8">
        {contact.has ? (
          <ul className="grid gap-4 text-base">
            {contact.email && <li className="flex gap-3"><Mail className="mt-1 size-5 shrink-0 text-brand" aria-hidden /><a className="break-all hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></li>}
            {contact.phone && <li className="flex gap-3"><Phone className="mt-1 size-5 shrink-0 text-brand" aria-hidden /><a className="hover:underline" href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></li>}
            {contact.address && <li className="flex gap-3"><MapPin className="mt-1 size-5 shrink-0 text-brand" aria-hidden /><span>{contact.address}</span></li>}
          </ul>
        ) : <p className="text-muted">Rəsmi əlaqə məlumatları hələ əlavə edilməyib.</p>}
      </Card>

      <section className="mt-8" aria-labelledby="contact-message-title">
        <Card className="p-6 sm:p-8">
          <h2 id="contact-message-title" className="text-xl font-extrabold">Əməkdaşa mesaj göndərin</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Qeydiyyat və ya giriş tələb olunmur. Əməkdaşı seçin, ad və qrupunuzu yazın.</p>
          {loading ? <Skeleton className="h-64" />
            : error ? <ErrorState message={error} onRetry={reload} />
            : recipients.length ? <StaffMessageForm recipients={recipients} />
            : <p className="text-muted">Mesaj göndərmək üçün hazırda əməkdaş əlavə olunmayıb.</p>}
        </Card>
      </section>
    </div>
  );
}
