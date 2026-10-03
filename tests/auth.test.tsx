import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Supabase Auth saxta klienti: onAuthStateChange callback-i tutulur ki, sessiya hadisələrini özümüz verə bilək.
const h = vi.hoisted(() => {
  type Cb = (event: string, session: { user: { id: string; email: string } } | null) => void;
  const s = {
    cb: null as Cb | null,
    unsub: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    reset: vi.fn(),
    update: vi.fn(),
    fetchProfile: vi.fn(),
    updateOwnProfile: vi.fn(),
  };
  const auth = {
    onAuthStateChange: (cb: Cb) => { s.cb = cb; return { data: { subscription: { unsubscribe: s.unsub } } }; },
    signInWithPassword: s.signIn,
    signUp: s.signUp,
    signOut: s.signOut,
    resetPasswordForEmail: s.reset,
    updateUser: s.update,
  };
  return { s, auth };
});

vi.mock('@/lib/supabase', () => ({
  isConfigured: true,
  supabase: { auth: h.auth },
  NotConfiguredError: class extends Error {},
}));
vi.mock('@/services/profiles', () => ({ fetchProfile: h.s.fetchProfile, updateOwnProfile: h.s.updateOwnProfile }));

import { AuthProvider, useAuth } from '@/context/AuthContext';

let ctx: ReturnType<typeof useAuth>;
function Probe(): ReactNode { ctx = useAuth(); return <div data-testid="state">{ctx.loading ? 'loading' : ctx.user ? `user:${ctx.user.uid}:${ctx.role}` : 'guest'}</div>; }
const mount = () => render(<AuthProvider><Probe /></AuthProvider>);
const emit = (event: string, session: { user: { id: string; email: string } } | null) => act(async () => { h.s.cb?.(event, session); });
const profile = (role: string) => ({ uid: 'u1', firstName: 'Aysel', lastName: 'M', email: 'a@b.az', role });

beforeEach(() => { Object.values(h.s).forEach((f) => typeof f === 'function' && 'mockReset' in f && (f as ReturnType<typeof vi.fn>).mockReset()); h.s.cb = null; });

describe('sessiya', () => {
  it('sessiya yoxdursa: loading bitir, istifadəçi qonaqdır', async () => {
    mount();
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await emit('INITIAL_SESSION', null);
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
  });

  it('səhifə yenilənəndə mövcud sessiya bərpa olunur və profil/rol serverdən yüklənir', async () => {
    h.s.fetchProfile.mockResolvedValue(profile('admin'));
    mount();
    await emit('INITIAL_SESSION', { user: { id: 'u1', email: 'a@b.az' } });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:u1:admin'));
    expect(h.s.fetchProfile).toHaveBeenCalledWith('u1');
  });

  it('profil yüklənənə qədər loading qalır (qorunan səhifə səhvən "icazə yoxdur" göstərməsin)', async () => {
    let resolve!: (v: unknown) => void;
    h.s.fetchProfile.mockReturnValue(new Promise((r) => { resolve = r; }));
    mount();
    await emit('SIGNED_IN', { user: { id: 'u1', email: 'a@b.az' } });
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await act(async () => { resolve(profile('student')); });
    expect(screen.getByTestId('state')).toHaveTextContent('user:u1:student');
  });

  it('token yenilənməsi (eyni istifadəçi) profili yenidən yükləmir və loading yaratmır', async () => {
    h.s.fetchProfile.mockResolvedValue(profile('student'));
    mount();
    await emit('INITIAL_SESSION', { user: { id: 'u1', email: 'a@b.az' } });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:u1:student'));
    await emit('TOKEN_REFRESHED', { user: { id: 'u1', email: 'a@b.az' } });
    expect(screen.getByTestId('state')).toHaveTextContent('user:u1:student');
    expect(h.s.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it('çıxışdan sonra profil və rol təmizlənir', async () => {
    h.s.fetchProfile.mockResolvedValue(profile('admin'));
    mount();
    await emit('INITIAL_SESSION', { user: { id: 'u1', email: 'a@b.az' } });
    await waitFor(() => expect(ctx.profile).not.toBeNull());
    await emit('SIGNED_OUT', null);
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
    expect(ctx.profile).toBeNull();
    expect(ctx.role).toBe('student');
  });

  it('profil sətri yoxdursa (null) rol student qalır, rol "yüksəldilmir"', async () => {
    h.s.fetchProfile.mockResolvedValue(null);
    mount();
    await emit('SIGNED_IN', { user: { id: 'u9', email: 'x@y.az' } });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:u9:student'));
    expect(ctx.profile).toBeNull();
  });

  it('unmount zamanı abunəlik ləğv edilir', () => {
    const { unmount } = mount();
    unmount();
    expect(h.s.unsub).toHaveBeenCalled();
  });
});

describe('giriş / qeydiyyat / şifrə', () => {
  beforeEach(async () => { mount(); await emit('INITIAL_SESSION', null); });

  it('login: e-poçt trim olunur; Supabase xətası atılır', async () => {
    h.s.signIn.mockResolvedValue({ error: null });
    await ctx.login('  a@b.az ', 'parol1234');
    expect(h.s.signIn).toHaveBeenCalledWith({ email: 'a@b.az', password: 'parol1234' });
    h.s.signIn.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'x' } });
    await expect(ctx.login('a@b.az', 'yanlis')).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('register: metadata-da ROL GÖNDƏRİLMİR; yalnız ad, soyad, pillə, kurs, bilet nömrəsi', async () => {
    h.s.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: { access_token: 't' } }, error: null });
    const res = await ctx.register({ firstName: ' Aysel ', lastName: 'M', email: ' a@b.az ', password: 'parol1234', degree: 'magistr', course: 2, studentId: ' S-1 ' });
    const arg = h.s.signUp.mock.calls[0][0];
    expect(arg.email).toBe('a@b.az');
    expect(arg.options.data).toEqual({ first_name: 'Aysel', last_name: 'M', degree: 'magistr', course: 2, student_id: 'S-1' });
    expect(arg.options.data).not.toHaveProperty('role');
    expect(arg.options.emailRedirectTo).toMatch(/\/login$/);
    expect(res).toEqual({ needsEmailConfirmation: false });
  });

  it('register: sessiya qaytarılmırsa e-poçt təsdiqi tələb olunur', async () => {
    h.s.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    const res = await ctx.register({ firstName: 'A', lastName: 'M', email: 'a@b.az', password: 'parol1234', degree: 'bakalavr', course: 1 });
    expect(res).toEqual({ needsEmailConfirmation: true });
  });

  it('register: mövcud e-poçt (boş identities) xəta kimi bildirilir', async () => {
    h.s.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    await expect(ctx.register({ firstName: 'A', lastName: 'M', email: 'a@b.az', password: 'parol1234', degree: 'bakalavr', course: 1 }))
      .rejects.toMatchObject({ code: 'user_already_exists' });
  });

  it('şifrə sıfırlama /reset-password ünvanına yönləndirir; yeni şifrə updateUser ilə yazılır', async () => {
    h.s.reset.mockResolvedValue({ error: null });
    await ctx.resetPassword(' a@b.az ');
    expect(h.s.reset).toHaveBeenCalledWith('a@b.az', { redirectTo: expect.stringMatching(/\/reset-password$/) });
    h.s.update.mockResolvedValue({ error: null });
    await ctx.updatePassword('yeniParol123');
    expect(h.s.update).toHaveBeenCalledWith({ password: 'yeniParol123' });
  });

  it('logout supabase.auth.signOut çağırır', async () => {
    h.s.signOut.mockResolvedValue({ error: null });
    await ctx.logout();
    expect(h.s.signOut).toHaveBeenCalled();
  });

  it('updateProfile: giriş yoxdursa NotConfigured kimi rədd edilir', async () => {
    await expect(ctx.updateProfile({ firstName: 'A', lastName: 'B' })).rejects.toBeInstanceOf(Error);
    expect(h.s.updateOwnProfile).not.toHaveBeenCalled();
  });
});

describe('profil yeniləmə', () => {
  it('yeni profil serverdən qayıdan sətirlə əvəz olunur', async () => {
    h.s.fetchProfile.mockResolvedValue(profile('student'));
    h.s.updateOwnProfile.mockResolvedValue({ ...profile('student'), firstName: 'Yeni' });
    mount();
    await emit('SIGNED_IN', { user: { id: 'u1', email: 'a@b.az' } });
    await waitFor(() => expect(ctx.profile?.firstName).toBe('Aysel'));
    await act(async () => { await ctx.updateProfile({ firstName: 'Yeni', lastName: 'M' }); });
    expect(h.s.updateOwnProfile).toHaveBeenCalledWith('u1', { firstName: 'Yeni', lastName: 'M' });
    expect(ctx.profile?.firstName).toBe('Yeni');
  });
});
