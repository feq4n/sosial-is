import { Briefcase, Brain, Lightbulb, Scale } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { aboutSections as s } from '@/data/content';
import { Card, PageHeader, Reveal } from '@/components/ui';

const List = ({ items }: { items: string[] }) => <ul className="mt-3 grid gap-2">{items.map((i) => <li key={i} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />{i}</li>)}</ul>;

export default function About() {
  useSeo('İxtisas haqqında', 'Sosial iş ixtisasının məqsədi, cəmiyyətdə rolu, öyrənilən bilik və bacarıqlar, karyera istiqamətləri.');
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Sosial iş ixtisası haqqında" />
      <p role="note" className="mb-8 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-ink dark:text-accent">{s.notice}</p>
      <div className="grid gap-5 md:grid-cols-2">
        <Reveal><Card className="h-full p-6"><Scale className="size-6 text-brand" aria-hidden /><h2 className="mt-3 text-xl font-bold">{s.goal.title}</h2><p className="mt-2 leading-relaxed text-muted">{s.goal.text}</p></Card></Reveal>
        <Reveal delay={0.05}><Card className="h-full p-6"><Lightbulb className="size-6 text-brand" aria-hidden /><h2 className="mt-3 text-xl font-bold">{s.role.title}</h2><p className="mt-2 leading-relaxed text-muted">{s.role.text}</p></Card></Reveal>
        <Reveal><Card className="h-full p-6"><Brain className="size-6 text-brand" aria-hidden /><h2 className="mt-3 text-xl font-bold">Öyrənilən biliklər</h2><List items={s.knowledge} /></Card></Reveal>
        <Reveal delay={0.05}><Card className="h-full p-6"><h2 className="text-xl font-bold">İnkişaf etdirilən bacarıqlar</h2><List items={s.skills} /></Card></Reveal>
      </div>
      <Reveal><Card className="mt-5 p-6"><Briefcase className="size-6 text-brand" aria-hidden /><h2 className="mt-3 text-xl font-bold">Fəaliyyət istiqamətləri</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{s.careers.map((c) => <li key={c} className="rounded-xl bg-surface-2 px-4 py-3 font-medium">{c}</li>)}</ul></Card></Reveal>
      <Reveal><Card className="mt-5 p-6"><h2 className="text-xl font-bold">Tələbələr üçün qeydlər</h2><List items={s.tips} /></Card></Reveal>
    </div>
  );
}
