import { Mail, MapPin, Phone } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { useContactInfo } from '@/services/site';
import { Card, PageHeader } from '@/components/ui';

export default function Contact() {
  useSeo('Əlaqə', 'Sosial İş şöbəsinin rəsmi əlaqə məlumatları.');
  const contact = useContactInfo();
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
    </div>
  );
}
