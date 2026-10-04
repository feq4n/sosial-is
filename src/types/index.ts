export type Role = 'student' | 'editor' | 'admin';

/** Giriş etmiş istifadəçinin minimal auth məlumatı (Supabase Auth istifadəçisindən götürülür). */
export interface AuthUser {
  uid: string;
  email: string | null;
}

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  studentId?: string;
  specialty?: string;
  group?: string;
  createdAt?: string;
}

export type AnnouncementCategory = 'umumi' | 'tedris' | 'imtahan' | 'telebe-heyati' | 'praktika';

export interface Announcement {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: AnnouncementCategory;
  important: boolean;
  published: boolean;
  createdAt: string;
}

export type MaterialType = 'pdf' | 'doc' | 'ppt' | 'video' | 'link';

export interface Material {
  id: string;
  title: string;
  subject: string;
  author: string;
  description: string;
  url: string;
  fileType: MaterialType;
  createdAt: string;
}

export type EventCategory = 'seminar' | 'konfrans' | 'goenullu' | 'tedris-xarici' | 'praktika';

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startsAt: string;
  endsAt?: string;
  registrationOpen: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read';
  createdAt: string;
}

export interface PersonalNote {
  id: string;
  text: string;
  day: number;
  createdAt: string;
}

export interface NotificationItem {
  key: string;
  kind: 'announcement' | 'event';
  title: string;
  text: string;
  href: string;
  date: string;
  read: boolean;
}
