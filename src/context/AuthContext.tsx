import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc, Timestamp, type DocumentData } from 'firebase/firestore';
import { auth, db, isConfigured, NotConfiguredError } from '@/lib/firebase';
import { isValidPlacement } from '@/data/timetable';
import type { Role, UserProfile } from '@/types';

export interface RegisterInput {
  firstName: string; lastName: string; email: string; password: string;
  specialty: string; group: string; studentId?: string;
}
export interface ProfileUpdate { firstName: string; lastName: string; studentId?: string; specialty?: string; group?: string }

const invalidPlacement = () => Object.assign(new Error('invalid-placement'), { code: 'invalid-placement' });

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  role: Role;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth yalnız AuthProvider daxilində istifadə olunur');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile?.();
      unsubProfile = undefined;
      setUser(u);
      if (!u) { setProfile(null); setLoading(false); return; }
      setLoading(true);
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          if (snap.exists()) {
            const x = snap.data();
            setProfile({ ...(x as Omit<UserProfile, 'uid'>), uid: u.uid, createdAt: x.createdAt instanceof Timestamp ? x.createdAt.toDate().toISOString() : undefined });
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        () => { setProfile(null); setLoading(false); },
      );
    });
    return () => { unsubAuth(); unsubProfile?.(); };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    profile,
    // Rol yalnız serverdən oxunan profil sənədindən gəlir; interfeys üçün istifadə olunur,
    // həqiqi icazələr firestore.rules ilə yoxlanılır.
    role: profile?.role ?? 'student',
    loading,
    configured: isConfigured,
    async login(email, password) {
      if (!isConfigured) throw new NotConfiguredError();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    async register(input) {
      if (!isConfigured) throw new NotConfiguredError();
      if (!isValidPlacement(input.specialty, input.group)) throw invalidPlacement();
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: cred.user.email,
          role: 'student', // rol qeydiyyatda yalnız "student" ola bilər (firestore.rules)
          specialty: input.specialty,
          group: input.group,
          ...(input.studentId?.trim() ? { studentId: input.studentId.trim() } : {}),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        await deleteUser(cred.user).catch(() => undefined);
        throw e;
      }
      sendEmailVerification(cred.user).catch(() => undefined);
    },
    async logout() {
      if (isConfigured) await signOut(auth);
    },
    async resetPassword(email) {
      if (!isConfigured) throw new NotConfiguredError();
      await sendPasswordResetEmail(auth, email.trim());
    },
    async updateProfile(data) {
      if (!isConfigured || !user) throw new NotConfiguredError();
      const clean: { [k: string]: unknown } = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        updatedAt: serverTimestamp(),
      };
      if (data.studentId !== undefined) clean.studentId = data.studentId.trim();
      if (data.specialty !== undefined || data.group !== undefined) {
        if (!isValidPlacement(data.specialty ?? '', data.group ?? '')) throw invalidPlacement();
        clean.specialty = data.specialty;
        clean.group = data.group;
      }
      await updateDoc(doc(db, "users", user.uid), clean as DocumentData);
    },
  }), [user, profile, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
