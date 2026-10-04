import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role, TeamMember, UserProfile } from '@/types';

const h = vi.hoisted(() => ({
  auth: { user: null as unknown, profile: null as unknown, role: 'student' as Role, loading: false },
  team: [] as unknown[],
  users: [] as unknown[],
}));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    ...h.auth, configured: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn(),
  }),
}));

vi.mock('@/services/content', async (orig) => {
  const real = await orig<typeof import('@/services/content')>();
  return { ...real, teamApi: { ...real.teamApi, list: async () => h.team } };
});
vi.mock('@/services/users', async (orig) => {
  const real = await orig<typeof import('@/services/users')>();
  return { ...real, listUsers: async () => h.users, listMessages: async () => [] };
});

import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import AppRoutes from '@/routes/AppRoutes';
import { DEVELOPER } from '@/config/site';
import { faq } from '@/data/content';
import { isSafeFooterUrl } from '@/services/site';
import { checkMaterialFile, checkPhotoFile, extOf, friendlyUploadMessage, MAX_MATERIAL_BYTES } from '@/utils/upload';
import { friendlyError } from '@/utils/errors';

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <ThemeProvider><ToastProvider><AppRoutes /></ToastProvider></ThemeProvider>
  </MemoryRouter>,
);
const signIn = (role: Role) => Object.assign(h.auth, {
  user: { uid: 'u1', email: 'a@b.az' },
  profile: { uid: 'u1', firstName: 'Aysel', lastName: 'Məmmədova', email: 'a@b.az', role },
  role, loading: false,
});
beforeEach(() => { Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false }); h.team = []; h.users = []; });

const file = (bytes: number[] | string, name: string, type: string, size?: number) => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  const f = new File([data], name, { type });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0, 0];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe('qeydiyyat və profildə bilet nömrəsi / kurs yoxdur', () => {
  it('qeydiyyat formunda tələbə bileti sahəsi yoxdur', async () => {
    renderAt('/register');
    await screen.findByLabelText('Qrup');
    expect(screen.queryByLabelText(/bilet/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/kurs/i)).not.toBeInTheDocument();
  });

  it('profil səhifəsində tələbə bileti sahəsi yoxdur', async () => {
    signIn('student');
    renderAt('/dashboard/profile');
    await screen.findByLabelText('Ad');
    expect(screen.queryByLabelText(/bilet/i)).not.toBeInTheDocument();
  });

  it('dərs cədvəlində kurs filtri yoxdur, növbə filtri qalır', async () => {
    renderAt('/schedule');
    await screen.findByLabelText('Növbə');
    expect(screen.queryByLabelText('Kurs')).not.toBeInTheDocument();
    const shift = screen.getByLabelText('Növbə');
    expect([...shift.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Hamısı', 'I növbə', 'II növbə']);
  });
});

describe('footer', () => {
  it('developer qeydi və feqan.dev keçidi kliklənəndir, standart keçidlər təkrarsızdır', async () => {
    renderAt('/');
    const link = await screen.findByRole('link', { name: DEVELOPER.name });
    expect(link).toHaveAttribute('href', 'https://feqan.dev');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.parentElement?.textContent).toBe('Developed by Feqan Gəraylı');
    const nav = screen.getByRole('navigation', { name: 'Alt naviqasiya' });
    const labels = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('Komandamız');
  });

  it('footer keçidi yalnız daxili yol və ya https ola bilər', () => {
    expect(isSafeFooterUrl('/contact')).toBe(true);
    expect(isSafeFooterUrl('/')).toBe(true);
    expect(isSafeFooterUrl('https://adpk.edu.az')).toBe(true);
    for (const bad of ['//evil.com', 'javascript:alert(1)', 'http://x.az', '/\\evil', 'ftp://x', '/a b', '']) expect(isSafeFooterUrl(bad)).toBe(false);
  });
});

describe('Komandamız', () => {
  const member = (o: Partial<TeamMember>): TeamMember => ({ id: 'm1', fullName: 'Aysel Əliyeva', jobTitle: 'Layihə rəhbəri', bio: 'Qısa bio', sortOrder: 1, active: true, createdAt: '2026-01-01T00:00:00Z', ...o });

  it('üzv yoxdursa boş vəziyyət göstərir', async () => {
    renderAt('/team');
    expect(await screen.findByText('Komanda üzvləri hələ əlavə olunmayıb')).toBeInTheDocument();
  });

  it('üzv kartı ad, vəzifə, bio və yalnız təhlükəsiz https keçidlərini göstərir', async () => {
    h.team = [member({ websiteUrl: 'https://feqan.dev', githubUrl: 'javascript:alert(1)' })];
    renderAt('/team');
    expect(await screen.findByRole('heading', { level: 3, name: 'Aysel Əliyeva' })).toBeInTheDocument();
    expect(screen.getByText('Layihə rəhbəri')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aysel Əliyeva: Şəxsi sayt' })).toHaveAttribute('href', 'https://feqan.dev');
    expect(screen.queryByRole('link', { name: /GitHub/ })).not.toBeInTheDocument();
  });

  it('ana səhifədə üzv varsa “Komandamız” bölməsi görünür', async () => {
    h.team = [member({})];
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Komandamız' })).toBeInTheDocument();
  });

  it('admin paneli yalnız adminə açıqdır (redaktor yönləndirilmir, lakin icazəsiz görür)', async () => {
    signIn('editor');
    renderAt('/admin/team');
    expect(await screen.findByText('Bu bölməyə giriş icazəniz yoxdur')).toBeInTheDocument();
  });
});

describe('SSS', () => {
  it('ehtiyat suallar real və saytın funksiyalarına aiddir (qeydiyyat, növbə, material, elan, texniki problem)', () => {
    expect(faq.length).toBeGreaterThanOrEqual(8);
    const all = faq.map((f) => `${f.q} ${f.a}`).join(' ');
    for (const word of ['Qeydiyyat', 'növbə', 'material', 'Elan', 'Şifr', 'texniki problem']) expect(all.toLowerCase()).toContain(word.toLowerCase());
    expect(all).not.toMatch(/kurs/i);
    expect(all).not.toMatch(/bilet/i);
  });

  it('ana səhifədə suallar göstərilir', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Tez-tez verilən suallar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: faq[0].q })).toBeInTheDocument();
  });
});

describe('Super Admin istifadəçi siyahısında', () => {
  const user = (o: Partial<UserProfile>): UserProfile => ({ uid: 'x', firstName: 'A', lastName: 'B', email: 'a@b.az', role: 'student', ...o });

  it('Super Admin üçün rol dəyişdirmə seçimi göstərilmir, digərləri üçün göstərilir', async () => {
    signIn('admin');
    h.users = [
      user({ uid: 'sa', firstName: 'Feqan', lastName: 'Gəraylı', email: 'feqangerayli@gmail.com', role: 'admin', isSuperAdmin: true }),
      user({ uid: 's2', firstName: 'Cavid', lastName: 'Həsənov', email: 'c@b.az' }),
    ];
    renderAt('/admin/users');
    expect(await screen.findByText('Super Admin')).toBeInTheDocument();
    expect(screen.queryByLabelText('Feqan Gəraylı üçün rol')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cavid Həsənov üçün rol')).toBeInTheDocument();
  });
});

describe('rəng mövzusu', () => {
  it('index.css-də narıncı/kəhrəba rəng qalmayıb', () => {
    const css = readFileSync('src/index.css', 'utf8').toLowerCase();
    for (const old of ['#b7791f', '#fbf1dc', '#4a3000', '#e0b25c', '#35290f', '#1e1400']) expect(css).not.toContain(old);
  });
  it('qəbul balları başlığı yaşıl fonda açıq (brand-ink) mətnlə yazılır', () => {
    const src = readFileSync('src/components/SpecialtyCard.tsx', 'utf8');
    expect(src).not.toMatch(/text-accent"[^>]*>Qəbul balları/);
  });
});

describe('fayl yoxlaması (uzantı + MIME + ilk baytlar)', () => {
  it('düzgün PDF, DOCX, XLSX, PPT, TXT, ZIP qəbul edilir', async () => {
    expect((await checkMaterialFile(file(PDF, 'a.pdf', 'application/pdf'))).fileType).toBe('pdf');
    expect((await checkMaterialFile(file(ZIP, 'a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).fileType).toBe('doc');
    expect((await checkMaterialFile(file(ZIP, 'a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))).fileType).toBe('xls');
    expect((await checkMaterialFile(file(OLE, 'a.ppt', 'application/vnd.ms-powerpoint'))).fileType).toBe('ppt');
    expect((await checkMaterialFile(file('salam dünya', 'a.txt', 'text/plain'))).fileType).toBe('txt');
    expect((await checkMaterialFile(file(ZIP, 'a.zip', 'application/x-zip-compressed'))).fileType).toBe('zip');
  });

  it('icazəsiz tip, saxta uzantı, yanlış MIME, boş və böyük fayl rədd edilir', async () => {
    await expect(checkMaterialFile(file([0x4d, 0x5a, 0x90], 'a.exe', 'application/octet-stream'))).rejects.toThrow('dəstəklənmir');
    await expect(checkMaterialFile(file('<script>', 'a.pdf', 'application/pdf'))).rejects.toThrow('məzmunu');
    await expect(checkMaterialFile(file(PDF, 'a.pdf', 'text/html'))).rejects.toThrow('uyğun gəlmir');
    await expect(checkMaterialFile(file(PDF, 'a.docx', 'application/pdf'))).rejects.toThrow('uyğun gəlmir');
    await expect(checkMaterialFile(file([], 'a.pdf', 'application/pdf'))).rejects.toThrow('boşdur');
    await expect(checkMaterialFile(file(PDF, 'a.pdf', 'application/pdf', MAX_MATERIAL_BYTES + 1))).rejects.toThrow('25 MB');
    await expect(checkMaterialFile(file([0x68, 0x00, 0x69], 'a.txt', 'text/plain'))).rejects.toThrow('məzmunu');
  });

  it('şəkil: JPG/PNG/WEBP qəbul edilir, SVG və saxta şəkil rədd edilir', async () => {
    expect((await checkPhotoFile(file([0xff, 0xd8, 0xff, 0xe0], 'a.jpeg', 'image/jpeg'))).ext).toBe('jpg');
    expect((await checkPhotoFile(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a.png', 'image/png'))).ext).toBe('png');
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect((await checkPhotoFile(file(webp, 'a.webp', 'image/webp'))).ext).toBe('webp');
    await expect(checkPhotoFile(file('<svg>', 'a.svg', 'image/svg+xml'))).rejects.toThrow('formatında');
    await expect(checkPhotoFile(file('GIF89a', 'a.png', 'image/png'))).rejects.toThrow('məzmunu');
    await expect(checkPhotoFile(file([0xff, 0xd8, 0xff], 'a.jpg', 'image/jpeg', 3 * 1024 * 1024))).rejects.toThrow('2 MB');
  });

  it('extOf və Storage xətaları aydın mesaja çevrilir', () => {
    expect(extOf('Hesabat.Final.PDF')).toBe('pdf');
    expect(extOf('adsız')).toBe('');
    expect(friendlyUploadMessage({ message: 'new row violates row-level security policy' })).toContain('icazəniz yoxdur');
    expect(friendlyUploadMessage({ message: 'mime type not supported' })).toContain('tipini');
    expect(friendlyUploadMessage({ message: 'The object exceeded the maximum allowed size' })).toContain('ölçüdən');
    expect(friendlyUploadMessage({ message: 'Failed to fetch' })).toContain('Şəbəkə');
  });

  it('Super Admin və fayl xətaları üçün istifadəçi mesajları', () => {
    expect(friendlyError({ code: '42501', message: 'super-admin-protected' })).toContain('Super Admin');
    expect(friendlyError({ code: '23514', message: 'file-too-large' })).toContain('25 MB');
  });
});
