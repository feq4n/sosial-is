import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isConfigured, NotConfiguredError } from '@/lib/supabase';
import { fetchProfile, updateOwnProfile, type ProfileUpdate } from '@/services/profiles';
import { isValidPlacement } from '@/data/timetable';
import type { AuthUser, Role, UserProfile } from '@/types';

export interface RegisterInput {
  firstName: string; lastName: string; email: string; password: string;
  specialty: string; group: string; studentId?: string;
}
export type { ProfileUpdate };

const invalidPlacement = () => Object.assign(new Error('invalid-placement'), { code: 'invalid-placement' });

/** E-poçt təsdiqi Supabase-də aktivdirsə, qeydiyyatdan sonra sessiya təsdiq keçidinə qədər açılmır. */
export interface RegisterResult { needsEmailConfirmation: boolean }

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: Role;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth yalnız AuthProvider daxilində istifadə olunur');
  return v;
}

const toAuthUser = (u: User | null | undefined): AuthUser | null => (u ? { uid: u.id, email: u.email ?? null } : null);
const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const uidRef = useRef<string | null>(null);

  // Sessiya: ilkin yükləmə, giriş/çıxış və tokenin avtomatik yenilənməsi eyni abunəlikdən gəlir.
  // Qeyd: bu callback daxilində Supabase sorğusu GÖZLƏNİLMİR (kilidlənmənin qarşısı); profil ayrıca effektdə yüklənir.
  useEffect(() => {
    if (!isConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = toAuthUser(session?.user);
      if (next?.uid !== uidRef.current) {
        uidRef.current = next?.uid ?? null;
        setLoading(next !== null); // profil yüklənənə qədər qorunan səhifələr yönləndirməsin
        if (!next) setProfile(null);
      }
      setUser((prev) => (prev?.uid === next?.uid && prev?.email === next?.email ? prev : next));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = user?.uid;
  useEffect(() => {
    if (!isConfigured || !uid) return;
    let alive = true;
    const load = (initial: boolean) =>
      fetchProfile(uid)
        .then((p) => { if (alive) setProfile(p); })
        .catch(() => { if (alive && initial) setProfile(null); })
        .finally(() => { if (alive && initial) setLoading(false); });
    load(true);
    // Rol admin tərəfindən dəyişdirilibsə, səhifəyə qayıdanda yenilənir (əvvəlki canlı abunəliyin əvəzinə).
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, [uid]);

  const value = useMemo<AuthState>(() => ({
    user,
    profile,
    // Rol yalnız serverdən oxunan profildən gəlir; interfeys üçün istifadə olunur,
    // həqiqi icazələr Postgres RLS siyasətləri ilə serverdə yoxlanılır.
    role: profile?.role ?? 'student',
    loading,
    configured: isConfigured,
    async login(email, password) {
      if (!isConfigured) throw new NotConfiguredError();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    async register(input) {
      if (!isConfigured) throw new NotConfiguredError();
      if (!isValidPlacement(input.specialty, input.group)) throw invalidPlacement();
      // Profil sətri verilənlər bazasındakı tətik ilə yaranır; rol həmişə "student"-dir (metadata-dan oxunmur).
      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          emailRedirectTo: `${origin()}/login`,
          data: {
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            specialty: input.specialty,
            group: input.group,
            ...(input.studentId?.trim() ? { student_id: input.studentId.trim() } : {}),
          },
        },
      });
      if (error) throw error;
      // E-poçt təsdiqi aktivdirsə, mövcud e-poçt xəta vermir, lakin identities boş qayıdır.
      if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists', message: 'user_already_exists' };
      return { needsEmailConfirmation: !data.session };
    },
    async logout() {
      if (isConfigured) await supabase.auth.signOut();
    },
    async resetPassword(email) {
      if (!isConfigured) throw new NotConfiguredError();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/reset-password` });
      if (error) throw error;
    },
    async updatePassword(password) {
      if (!isConfigured) throw new NotConfiguredError();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    async updateProfile(data) {
      if (!isConfigured || !user) throw new NotConfiguredError();
      if ((data.specialty !== undefined || data.group !== undefined) && !isValidPlacement(data.specialty ?? '', data.group ?? '')) throw invalidPlacement();
      setProfile(await updateOwnProfile(user.uid, data));
    },
  }), [user, profile, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
