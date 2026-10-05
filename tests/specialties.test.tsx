import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@/types';

const h = vi.hoisted(() => ({
  auth: { user: null as unknown, profile: null as unknown, role: 'student' as Role, loading: false },
}));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    ...h.auth, configured: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn(),
  }),
}));

import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import AppRoutes from '@/routes/AppRoutes';
import { admissionGroups, defaultSpecialties, type SpecialtyInfo } from '@/data/specialties';
import { groups, specialties, specialtyFullLabel } from '@/data/timetable';
import { rowToSpecialty, toSpecialtyRow } from '@/services/specialties';

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <ThemeProvider><ToastProvider><AppRoutes /></ToastProvider></ThemeProvider>
  </MemoryRouter>,
);
const by = (code: string) => defaultSpecialties.find((s) => s.code === code) as SpecialtyInfo;

beforeEach(() => Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false }));

describe('ixtisas məlumatları (mərkəzi mənbə)', () => {
  it('üç ixtisas, düzgün tam ad və ixtisas kodları', () => {
    expect(defaultSpecialties.map((s) => s.code)).toEqual(['Sİ', 'KŞATS', 'KŞŞİ']);
    expect(by('Sİ')).toMatchObject({ fullName: 'Sosial İş', programCode: '040713' });
    expect(by('KŞATS')).toMatchObject({ fullName: 'Kompüter Şəbəkəsi Avadanlıqlarının Təmiri və Servisi', programCode: '040533' });
    expect(by('KŞŞİ')).toMatchObject({ fullName: 'Kompüter Şəbəkəsi və Şəbəkə İnzibatçılığı', programCode: '040532' });
  });

  it('hamısında müddət/semestr/kredit və təsvir var, kodlar təkrarlanmır', () => {
    for (const s of defaultSpecialties) {
      expect([s.duration, s.semesters, s.credits]).toEqual(['2-3', '4-6', '120']);
      expect(s.description.length).toBeGreaterThan(40);
    }
    expect(new Set(defaultSpecialties.map((s) => s.programCode)).size).toBe(3);
  });

  it('qəbul balları rəsmi saytdakı kimi və yalnız öz ixtisasına aiddir', () => {
    const flat = (s: SpecialtyInfo) => admissionGroups(s).map((g) => [g.title, ...g.rows.map((r) => `${r.label}=${r.value}`)].join('|'));
    expect(flat(by('Sİ'))).toEqual(['Ümumi orta bazası|Dövlət sifarişi=100,7|Ödənişli=89,3', 'Tam orta bazası|Dövlət sifarişi=130|Ödənişli (əyani)=90,8|Ödənişli (qiyabi)=40,4']);
    expect(flat(by('KŞATS'))).toEqual(['Ümumi orta bazası|Dövlət sifarişi=115,6|Ödənişli=157,3', 'Tam orta bazası|Dövlət sifarişi=110,1|Ödənişli (əyani)=148,1']);
    expect(flat(by('KŞŞİ'))).toEqual(['Ümumi orta bazası|Dövlət sifarişi=133,4|Ödənişli=106,5', 'Tam orta bazası|Dövlət sifarişi=150,6|Ödənişli (əyani)=116,4']);
  });

  it('təsdiqlənməmiş və ya boş qəbul məlumatı gizlədilir', () => {
    expect(admissionGroups({ ...by('KŞŞİ'), admissionConfirmed: false })).toEqual([]);
    const empty = { ...by('KŞŞİ'), scoreGeneralState: undefined, scoreGeneralPaid: undefined, scoreCompleteState: undefined, scoreCompletePaid: undefined };
    expect(admissionGroups(empty)).toEqual([]);
  });

  it('cədvəldəki 29 qrup 12/6/11 şəklində bölünür və hər qrup mövcud ixtisasdadır', () => {
    const count = (c: string) => groups.filter((g) => g.specialty === c).length;
    expect(groups).toHaveLength(29);
    expect([count('Sİ'), count('KŞATS'), count('KŞŞİ')]).toEqual([12, 6, 11]);
    const codes = new Set(defaultSpecialties.map((s) => s.code));
    expect(groups.every((g) => codes.has(g.specialty))).toBe(true);
    expect(specialties.map((s) => s.code).sort()).toEqual([...codes].sort());
  });

  it('seçim siyahısı üçün tam ad etiketi', () => {
    expect(specialtyFullLabel('Sİ')).toBe('Sosial İş');
    expect(specialtyFullLabel('KŞŞİ')).toBe('Kompüter Şəbəkəsi və Şəbəkə İnzibatçılığı (KŞŞİ)');
  });
});

describe('Supabase sətir çevirmələri (specialties)', () => {
  it('snake_case sətir → SpecialtyInfo, null sahələr buraxılır', () => {
    const s = rowToSpecialty({ code: 'KŞŞİ', name: 'KŞŞİ', full_name: 'Tam ad', program_code: '040532', description: 'x', degree: 'D', duration: '2-3', score_complete_paid_part: null, admission_confirmed: true, active: true, sort_order: 3 });
    expect(s).toMatchObject({ fullName: 'Tam ad', programCode: '040532', admissionConfirmed: true, sortOrder: 3 });
    expect(s.scoreCompletePaidPart).toBeUndefined();
  });

  it('boş sahələr yeniləmədə null olur (köhnə bal qalmır), kod dəyişmir', () => {
    const row = toSpecialtyRow({ code: 'HACKED', name: 'Ad', scoreGeneralState: undefined, programCode: '', admissionConfirmed: false, sortOrder: 2 } as Partial<SpecialtyInfo>);
    expect(row).toMatchObject({ name: 'Ad', score_general_state: null, program_code: null, admission_confirmed: false, sort_order: 2 });
    expect(row).not.toHaveProperty('code');
  });
});

describe('ana səhifə və ixtisaslar səhifəsi', () => {
  it('/about: üç ixtisas kartı eyni quruluşla göstərilir', async () => {
    renderAt('/about');
    const cards = await Promise.all(['Sİ', 'KŞATS', 'KŞŞİ'].map((c) => screen.findByTestId(`specialty-${c}`)));
    for (const [i, card] of cards.entries()) {
      const s = defaultSpecialties[i];
      const q = within(card);
      expect(q.getByRole('heading', { level: 3, name: s.fullName })).toBeInTheDocument();
      expect(q.getByText(s.programCode!)).toBeInTheDocument();
      expect(q.getByText(s.description)).toBeInTheDocument();
      expect(q.getByText('2-3 il')).toBeInTheDocument();
      expect(q.getByText('4-6 semestr')).toBeInTheDocument();
      expect(q.getByText('120 kredit')).toBeInTheDocument();
      expect(q.getByText(/Qəbul balları/)).toBeInTheDocument();
      expect(q.getByText('Ümumi orta bazası')).toBeInTheDocument();
    }
    expect(within(cards[0]).getByText('40,4 bal')).toBeInTheDocument();
    expect(within(cards[1]).queryByText('40,4 bal')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ADPU/);
  });

  it('/: üç ixtisas yığcam kartla, eyni quruluşla göstərilir (qəbul balları və statistika Home-da yoxdur)', async () => {
    renderAt('/');
    const cards = await Promise.all(['Sİ', 'KŞATS', 'KŞŞİ'].map((c) => screen.findByTestId(`specialty-${c}`)));
    for (const [i, card] of cards.entries()) {
      const s = defaultSpecialties[i];
      const q = within(card);
      expect(q.getByRole('heading', { level: 3, name: s.fullName })).toBeInTheDocument();
      expect(q.getByText(s.description)).toBeInTheDocument();
      expect(q.getByText(`${s.degree} · ${s.duration} il`)).toBeInTheDocument();
      expect(q.getByRole('link', { name: /Ətraflı bax/ })).toHaveAttribute('href', `/specialties/${encodeURIComponent(s.code)}`);
      expect(q.queryByText(/Qəbul balları/)).not.toBeInTheDocument();
    }
  });
});

describe('qeydiyyat: ixtisas → qrup', () => {
  it.each([['Sİ', 12], ['KŞATS', 6], ['KŞŞİ', 11]] as const)('%s seçildikdə yalnız öz %i qrupu göstərilir', async (code, n) => {
    const user = userEvent.setup();
    renderAt('/register');
    const spec = await screen.findByLabelText('İxtisas');
    expect([...spec.querySelectorAll('option')].map((o) => o.getAttribute('value')).filter(Boolean)).toEqual(['Sİ', 'KŞATS', 'KŞŞİ']);
    await user.selectOptions(spec, code);
    const values = [...screen.getByLabelText('Qrup').querySelectorAll('option')].map((o) => o.getAttribute('value')).filter(Boolean) as string[];
    expect(values).toHaveLength(n);
    expect(values.every((v) => groups.find((g) => g.code === v)?.specialty === code)).toBe(true);
    expect(screen.getByText(specialtyFullLabel(code), { selector: 'strong' })).toBeInTheDocument();
  });
});

describe('admin: ixtisaslar', () => {
  const signIn = (role: Role) => Object.assign(h.auth, {
    user: { uid: 'u1', email: 'a@b.az' },
    profile: { uid: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.az', role }, role, loading: false,
  });

  it('admin ixtisasları görür; “Əlavə et” və silmə düyməsi yoxdur', async () => {
    signIn('admin');
    renderAt('/admin/specialties');
    expect(await screen.findByRole('heading', { level: 1, name: 'İxtisaslar' })).toBeInTheDocument();
    expect(await screen.findByText('040532')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Əlavə et/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sil:/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Redaktə et:/ })).toHaveLength(3);
  });

  it('redaktor ixtisaslar idarəsinə daxil ola bilmir', async () => {
    signIn('editor');
    renderAt('/admin/specialties');
    expect(screen.queryByRole('heading', { level: 1, name: 'İxtisaslar' })).not.toBeInTheDocument();
  });
});
