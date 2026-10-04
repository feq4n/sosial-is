import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BookOpen, CalendarDays, ChevronDown, Clock, Megaphone, Sparkles, Users } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { announcementsApi, eventsApi, isSampleMode, materialsApi } from '@/services/content';
import { useAuth } from '@/context/AuthContext';
import { dayFromJsDate, dayHeading, findGroup, lessonsOfGroup, lessonView } from '@/data/timetable';
import { AdpkLogo, ADPK_NAME } from '@/components/Logo';
import { AnnouncementCard, EventCard, MaterialCard } from '@/components/cards';
import { ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, Reveal, SampleNotice } from '@/components/ui';
import { advantages, faq } from '@/data/content';
import { contact, hasContactInfo } from '@/config/site';
import { SpecialtyCards } from '@/components/SpecialtyCard';
import { useSpecialties } from '@/services/specialties';

function TodayPanel() {
  const { profile } = useAuth();
  const group = findGroup(profile?.group);
  const day = dayFromJsDate(new Date().getDay());
  const today = group && day ? lessonsOfGroup(group.code).filter((l) => l.day === day) : [];
  return (
    <Card className="relative overflow-hidden p-6 shadow-pop">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Bu gün{group ? ` · ${group.code}` : ''}</p>
          <h2 className="text-xl font-bold">{day ? dayHeading(day) : 'Həftə sonu'}</h2>
        </div>
        <Clock className="size-6 text-brand" aria-hidden />
      </div>
      <div className="mt-5 grid gap-3">
        {!group && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Qrupunuzun bugünkü dərslərini görmək üçün daxil olun və profilinizdə qrupu seçin.</p>}
        {group && !day && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Bu gün həftə sonudur, cədvəldə dərs yoxdur.</p>}
        {group && day && today.length === 0 && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Bu gün üçün cədvəldə dərs görünmür.</p>}
        {today.map((l) => {
          const v = lessonView(l);
          return (
            <div key={`${l.day}-${l.lesson}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <div className="w-16 shrink-0 text-center text-sm font-bold text-brand">{l.start}<div className="text-xs font-medium text-muted">{l.end}</div></div>
              <div className="min-w-0"><p className="truncate font-semibold">{v.subject}</p><p className="truncate text-xs text-muted">{v.room ? `Otaq ${v.room}` : 'Otaq göstərilməyib'}</p></div>
            </div>
          );
        })}
      </div>
      <Link to="/schedule" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Dərs cədvəlinə bax <ArrowRight className="size-4" aria-hidden /></Link>
    </Card>
  );
}

function Network() {
  const reduce = useReducedMotion();
  const nodes = [[60, 60], [200, 30], [330, 90], [130, 160], [270, 190]];
  return (
    <svg viewBox="0 0 400 230" className="pointer-events-none absolute -right-10 -top-8 hidden w-[28rem] opacity-60 md:block" aria-hidden>
      {[[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [2, 4]].map(([a, b], i) => (
        <motion.line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="var(--brand)" strokeWidth="1.5" strokeOpacity=".45"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 + i * 0.12 }} />
      ))}
      {nodes.map(([x, y], i) => <motion.circle key={i} cx={x} cy={y} r={i % 2 ? 9 : 12} fill={i % 2 ? 'var(--brand-dark)' : 'var(--brand)'}
        initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 + i * 0.1, type: 'spring' }} />)}
    </svg>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="grid gap-3">
      {faq.map((f, i) => (
        <Card key={f.q} className="overflow-hidden">
          <h3>
            <button className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
              {f.q}<ChevronDown className={`size-5 shrink-0 text-muted transition ${open === i ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div id={`faq-${i}`} initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <p className="px-5 pb-5 text-muted">{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  useSeo('Sosial İş', 'Azərbaycan Dövlət Pedaqoji Kollecinin Sosial İş, KŞATS və KŞŞİ ixtisasları üçün elanlar, dərs materialları, dərs cədvəli və tədbirlər bir yerdə.');
  const specs = useSpecialties();
  const ann = useAsync(() => announcementsApi.list(), []);
  const ev = useAsync(() => eventsApi.list(), []);
  const mat = useAsync(() => materialsApi.list(), []);
  const now = new Date().toISOString();
  const upcoming = (ev.data ?? []).filter((e) => e.startsAt >= now).slice(0, 3);

  const quick = [
    { to: '/announcements', icon: Megaphone, title: 'Elanlar', text: 'Şöbədən ən son xəbərlər' },
    { to: '/materials', icon: BookOpen, title: 'Materiallar', text: 'Fənlər üzrə dərs resursları' },
    { to: '/schedule', icon: CalendarDays, title: 'Dərs cədvəli', text: 'İxtisas, qrup və növbə üzrə' },
    { to: '/events', icon: Users, title: 'Tədbirlər', text: 'Seminar, konfrans, könüllülük' },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-soft/60 to-bg">
        <Network />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 shadow-card">
              <AdpkLogo className="size-12 sm:size-14" />
              <span className="max-w-[16rem] text-xs font-semibold leading-snug text-brand-dark dark:text-brand sm:text-sm">{ADPK_NAME}</span>
            </div>
            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">Kollec tələbəsinin gündəlik iş masası</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Elanlar, dərs materialları, cədvəl və tədbirlər bir səhifədə. Daxil olun, materialları yadda saxlayın, bildirişləri qaçırmayın.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register" size="lg">Qeydiyyatdan keç</ButtonLink>
              <ButtonLink to="/announcements" variant="secondary" size="lg">Elanlara bax</ButtonLink>
            </div>
          </div>
          <TodayPanel />
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 pt-14 sm:px-6">
        {isSampleMode && <SampleNotice />}

        <section aria-labelledby="spec-h">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <div><h2 id="spec-h" className="text-3xl font-extrabold">İxtisaslar</h2><p className="mt-2 max-w-2xl text-muted">Platforma {ADPK_NAME}nın üç ixtisası üçün eyni səviyyədə xidmət göstərir.</p></div>
            <Link to="/about" className="text-sm font-semibold text-brand hover:underline">Ətraflı</Link>
          </div>
          <SpecialtyCards items={specs} />
        </section>

        <section aria-labelledby="quick-h">
          <h2 id="quick-h" className="sr-only">Əsas bölmələr</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quick.map((q, i) => (
              <Reveal key={q.to} delay={i * 0.05}>
                <Link to={q.to} className="group block h-full">
                  <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-brand group-hover:shadow-pop">
                    <q.icon className="size-7 text-brand" aria-hidden />
                    <h3 className="mt-4 text-lg font-bold">{q.title}</h3>
                    <p className="mt-1 text-sm text-muted">{q.text}</p>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-h" className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 id="about-h" className="text-3xl font-extrabold">Platformanın məqsədi</h2>
            <p className="mt-3 text-muted">“Sosial İş” platforması Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələrinin tədris həyatı ilə bağlı bütün məlumatlara bir yerdən, sürətli və rahat çıxışını təmin edir. Məzmunu administratorlar idarə edir.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {advantages.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.05}>
                <Card className="h-full p-5"><Sparkles className="size-5 text-accent" aria-hidden /><h3 className="mt-3 font-bold">{a.title}</h3><p className="mt-1 text-sm text-muted">{a.text}</p></Card>
              </Reveal>
            ))}
          </div>
        </section>

        <section aria-labelledby="ann-h">
          <div className="mb-6 flex items-end justify-between gap-4"><h2 id="ann-h" className="text-3xl font-extrabold">Son elanlar</h2><Link to="/announcements" className="text-sm font-semibold text-brand hover:underline">Hamısı</Link></div>
          {ann.loading ? <ListSkeleton rows={3} /> : ann.error ? <ErrorState message={ann.error} onRetry={ann.reload} /> :
            ann.data?.length ? <div className="grid gap-4 md:grid-cols-3">{ann.data.slice(0, 3).map((a) => <AnnouncementCard key={a.id} a={a} />)}</div> :
              <EmptyState title="Hələ elan yoxdur" text="Yeni elanlar yayımlandıqda burada görünəcək." />}
        </section>

        <section aria-labelledby="ev-h">
          <div className="mb-6 flex items-end justify-between gap-4"><h2 id="ev-h" className="text-3xl font-extrabold">Yaxınlaşan tədbirlər</h2><Link to="/events" className="text-sm font-semibold text-brand hover:underline">Hamısı</Link></div>
          {ev.loading ? <ListSkeleton rows={2} /> : ev.error ? <ErrorState message={ev.error} onRetry={ev.reload} /> :
            upcoming.length ? <div className="grid gap-4 md:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> :
              <EmptyState title="Yaxın tədbir planlaşdırılmayıb" text="Tədbir əlavə olunduqda burada görünəcək." />}
        </section>

        <section aria-labelledby="mat-h">
          <div className="mb-6 flex items-end justify-between gap-4"><h2 id="mat-h" className="text-3xl font-extrabold">Tədris materialları</h2><Link to="/materials" className="text-sm font-semibold text-brand hover:underline">Bütün materiallar</Link></div>
          {mat.loading ? <ListSkeleton rows={2} /> : mat.error ? <ErrorState message={mat.error} onRetry={mat.reload} /> :
            mat.data?.length ? <div className="grid gap-4 md:grid-cols-3">{mat.data.slice(0, 3).map((m) => <MaterialCard key={m.id} m={m} />)}</div> :
              <EmptyState title="Material hələ əlavə olunmayıb" />}
        </section>

        <section aria-labelledby="res-h">
          <h2 id="res-h" className="mb-6 text-3xl font-extrabold">Tələbələr üçün faydalı bölmələr</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { to: '/about', t: 'İxtisaslar haqqında', x: 'Üç ixtisasın təsviri, müddəti, krediti və qəbul balları.' },
              { to: '/dashboard/saved', t: 'Saxlanılan materiallar', x: 'İmtahan öncəsi lazım olan resursları şəxsi siyahıda toplayın.' },
              { to: '/dashboard/schedule', t: 'Şəxsi cədvəl və qeydlər', x: 'Dərs cədvəlinə öz qeydlərinizi əlavə edin.' },
            ].map((r) => (
              <Link key={r.to} to={r.to} className="group block"><Card className="h-full p-5 transition group-hover:border-brand"><h3 className="font-bold group-hover:text-brand">{r.t}</h3><p className="mt-1 text-sm text-muted">{r.x}</p></Card></Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-h" className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div><h2 id="faq-h" className="text-3xl font-extrabold">Tez-tez verilən suallar</h2><p className="mt-3 text-muted">Cavab tapmadınızsa, bizə yazın.</p></div>
          <Faq />
        </section>

        <section aria-labelledby="contact-h">
          <Card className="grid gap-6 bg-brand p-8 text-brand-ink sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <h2 id="contact-h" className="text-3xl font-extrabold">Sualınız var?</h2>
              <p className="mt-2 opacity-90">Əlaqə formasını doldurun, mesajınız administratorlara çatacaq.</p>
              <ButtonLink to="/contact" variant="accent" className="mt-5">Mesaj göndər</ButtonLink>
            </div>
            {hasContactInfo && (
              <ul className="grid gap-1.5 text-sm opacity-95">
                {contact.email && <li>{contact.email}</li>}{contact.phone && <li>{contact.phone}</li>}{contact.address && <li>{contact.address}</li>}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
