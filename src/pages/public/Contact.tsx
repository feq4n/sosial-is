import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { sendContactMessage, type ContactPayload } from '@/services/contact';
import { contact, hasContactInfo } from '@/config/site';
import { Button, Card, ErrorBanner, PageHeader, SuccessBanner, TextArea, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
  useSeo('Əlaqə', 'Sosial İş platforması ilə əlaqə: sual, təklif və ya səhv barədə mesaj göndərin.');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactPayload>();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setStatus(null);
    try {
      await sendContactMessage(v);
      reset();
      setStatus({ ok: true, text: 'Mesajınız göndərildi. Ən qısa zamanda cavab veriləcək.' });
    } catch (e) {
      setStatus({ ok: false, text: friendlyError(e) });
    }
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Əlaqə" text="Sual, təklif və ya düzəliş üçün mesaj yazın." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={onSubmit} noValidate className="grid gap-5" aria-label="Əlaqə formu">
            <TextField label="Ad və soyad" autoComplete="name" error={errors.name?.message}
              {...register('name', { required: 'Ad və soyadı yazın', minLength: { value: 2, message: 'Ən azı 2 simvol yazın' }, maxLength: { value: 100, message: 'Ən çox 100 simvol' } })} />
            <TextField label="E-poçt ünvanı" type="email" autoComplete="email" error={errors.email?.message}
              {...register('email', { required: 'E-poçt ünvanını yazın', pattern: { value: emailRe, message: 'E-poçt ünvanı düzgün deyil' }, maxLength: { value: 160, message: 'Çox uzundur' } })} />
            <TextField label="Mövzu" error={errors.subject?.message}
              {...register('subject', { required: 'Mövzunu yazın', minLength: { value: 3, message: 'Ən azı 3 simvol yazın' }, maxLength: { value: 150, message: 'Ən çox 150 simvol' } })} />
            <TextArea label="Mesaj" error={errors.message?.message} hint="10–3000 simvol"
              {...register('message', { required: 'Mesajı yazın', minLength: { value: 10, message: 'Mesaj ən azı 10 simvol olmalıdır' }, maxLength: { value: 3000, message: 'Mesaj ən çox 3000 simvol ola bilər' } })} />
            <Button type="submit" size="lg" loading={isSubmitting}>Göndər</Button>
            {status && (status.ok ? <SuccessBanner>{status.text}</SuccessBanner> : <ErrorBanner>{status.text}</ErrorBanner>)}
          </form>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="text-lg font-bold">Rəsmi əlaqə məlumatları</h2>
          {hasContactInfo ? (
            <ul className="mt-4 grid gap-3 text-sm">
              {contact.email && <li className="flex gap-2.5"><Mail className="size-4 shrink-0 text-brand mt-0.5" aria-hidden /><a className="hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              {contact.phone && <li className="flex gap-2.5"><Phone className="size-4 shrink-0 text-brand mt-0.5" aria-hidden /><a className="hover:underline" href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></li>}
              {contact.address && <li className="flex gap-2.5"><MapPin className="size-4 shrink-0 text-brand mt-0.5" aria-hidden />{contact.address}</li>}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Rəsmi əlaqə məlumatları hələ əlavə edilməyib. Mesajlarınız əlaqə formu vasitəsilə qəbul olunur.</p>}
        </Card>
      </div>
    </div>
  );
}
