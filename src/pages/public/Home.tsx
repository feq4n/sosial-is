import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { announcementsApi, eventsApi, isSampleMode, materialsApi } from '@/services/content';
import { useAuth } from '@/context/AuthContext';
import { dayFromJsDate, dayHeading, findGroup, lessonsOfGroup, lessonView, variantLabel } from '@/data/timetable';
import { ADPK_NAME } from '@/components/Logo';
import { AnnouncementCard, EventCard, MaterialCard } from '@/components/cards';
import { ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, SampleNotice } from '@/components/ui';
import { useSiteSettings } from '@/services/site';
import { SpecialtyCarousel } from '@/components/SpecialtyCard';
import { useSpecialties } from '@/services/specialties';

function TodayPanel() {
  const { profile } = useAuth();
  const group = findGroup(profile?.group);
  const day = dayFromJsDate(new Date().getDay());
  const today = group && day ? lessonsOfGroup(group.code).filter((l) => l.day === day) : [];
  const note = (text: string) => <p className="rounded-xl bg-surface-2 p-3.5 text-sm text-muted">{text}</p>;
  return (
    <Card className="p-5 shadow-pop">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Bu gün{group ? ` · ${group.code}` : ''}</p>
          <h2 className="text-lg font-bold">{day ? dayHeading(day) : 'Həftə sonu'}</h2>
        </div>
        <Clock className="size-5 text-brand" aria-hidden />
      </div>
      <div className="mt-4 grid gap-2.5">
        {!group && note('Bugünkü dərslərinizi görmək üçün daxil olun və profilinizdə qrupu seçin.')}
        {group && !day && note('Bu gün həftə sonudur, cədvəldə dərs yoxdur.')}
        {group && day && today.length === 0 && note('Bu gün üçün cədvəldə dərs görünmür.')}
        {today.map((l, i) => {
          const v = lessonView(l);
          const variant = variantLabel(l);
          return (
            <div key={`${l.day}-${l.lesson}-${l.week}-${l.subgroup ?? 0}-${i}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <div className="w-14 shrink-0 text-center text-sm font-bold text-brand">{l.start}<div className="text-xs font-medium text-muted">{l.end}</div></div>
              <div className="min-w-0"><p className="truncate font-semibold">{v.subject}</p><p className="truncate text-xs text-muted">{[v.kind, variant, v.room ? `Otaq ${v.room}` : 'Otaq göstərilməyib'].filter(Boolean).join(' · ')}</p></div>
            </div>
          );
        })}
      </div>
      <Link to="/schedule" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Dərs cədvəlinə bax <ArrowRight className="size-4" aria-hidden /></Link>
    </Card>
  );
}

function SectionHead({ id, title, to, linkText = 'Hamısı' }: { id: string; title: string; to: string; linkText?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
      <Link to={to} className="shrink-0 text-sm font-semibold text-brand hover:underline">{linkText}</Link>
    </div>
  );
}

/** Home yalnız gündəlik lazım olanı göstərir: qısa hero, ixtisaslar, son elanlar, materiallar, tədbirlər. */
export default function Home() {
  useSeo('Sosial İş', 'Azərbaycan Dövlət Pedaqoji Kollecinin Sosial İş, KŞATS və KŞŞİ ixtisasları üçün elanlar, dərs materialları, dərs cədvəli və tədbirlər bir yerdə.');
  const { user } = useAuth();
  const specs = useSpecialties();
  const site = useSiteSettings();
  const ann = useAsync(() => announcementsApi.list(), []);
  const ev = useAsync(() => eventsApi.list(), []);
  const mat = useAsync(() => materialsApi.list(), []);
  const now = new Date().toISOString();
  const upcoming = (ev.data ?? []).filter((e) => e.startsAt >= now).slice(0, 3);

  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-brand-soft/50 to-bg">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-brand">{ADPK_NAME}</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-[1.1] sm:text-5xl">{site.homeTitle}</h1>
            <p className="mt-3 max-w-xl text-base text-muted sm:text-lg">{site.homeText}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {user ? (
                <>
                  <ButtonLink to="/dashboard" size="lg">Kabinet</ButtonLink>
                  <ButtonLink to="/dashboard/forms" variant="secondary" size="lg">Form cavablarım</ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink to="/register" size="lg">Qeydiyyatdan keç</ButtonLink>
                  <ButtonLink to="/login" variant="secondary" size="lg">Daxil ol</ButtonLink>
                </>
              )}
            </div>
          </div>
          <TodayPanel />
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-10 sm:px-6">
        {isSampleMode && <SampleNotice />}

        <section aria-labelledby="spec-h">
          <SectionHead id="spec-h" title="İxtisaslar" to="/about" linkText="Hamısı" />
          <SpecialtyCarousel items={specs} />
        </section>

        <section aria-labelledby="ann-h">
          <SectionHead id="ann-h" title="Son elanlar" to="/announcements" />
          {ann.loading ? <ListSkeleton rows={3} /> : ann.error ? <ErrorState message={ann.error} onRetry={ann.reload} /> :
            ann.data?.length ? <div className="grid gap-4 md:grid-cols-3">{ann.data.slice(0, 3).map((a) => <AnnouncementCard key={a.id} a={a} />)}</div> :
              <EmptyState title="Hələ elan yoxdur" text="Yeni elanlar yayımlandıqda burada görünəcək." />}
        </section>

        <section aria-labelledby="mat-h">
          <SectionHead id="mat-h" title="Son materiallar" to="/materials" />
          {mat.loading ? <ListSkeleton rows={2} /> : mat.error ? <ErrorState message={mat.error} onRetry={mat.reload} /> :
            mat.data?.length ? <div className="grid gap-4 md:grid-cols-3">{mat.data.slice(0, 3).map((m) => <MaterialCard key={m.id} m={m} />)}</div> :
              <EmptyState title="Material hələ əlavə olunmayıb" />}
        </section>

        <section aria-labelledby="ev-h">
          <SectionHead id="ev-h" title="Yaxın tədbirlər" to="/events" />
          {ev.loading ? <ListSkeleton rows={2} /> : ev.error ? <ErrorState message={ev.error} onRetry={ev.reload} /> :
            upcoming.length ? <div className="grid gap-4 md:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> :
              <EmptyState title="Yaxın tədbir planlaşdırılmayıb" text="Tədbir əlavə olunduqda burada görünəcək." />}
        </section>
      </div>
    </>
  );
}
