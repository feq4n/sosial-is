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
  isSuperAdmin?: boolean;
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

export type MaterialType = 'pdf' | 'doc' | 'ppt' | 'xls' | 'txt' | 'zip' | 'video' | 'link';

export interface Material {
  id: string;
  title: string;
  subject: string;
  author: string;
  description: string;
  url?: string;
  fileType: MaterialType;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  specialty?: string;
  groupName?: string;
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

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export interface FooterLink {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  jobTitle: string;
  bio: string;
  /** Kartın bağlı olduğu hesab (profiles.id). Yalnız belə əməkdaşlara mesaj göndərmək olar. */
  profileId?: string;
  photoPath?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  githubUrl?: string;
  telegramUrl?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export type StaffMessageStatus = 'sent' | 'read';

/** İstifadəçi → konkret şöbə əməkdaşı müraciəti (chat deyil). Ad və qrup sahələri göndərilmə anının snapshot-ıdır; qonaqda senderId olmur. */
export interface StaffMessage {
  id: string;
  senderId?: string;
  recipientId: string;
  subject: string;
  message: string;
  status: StaffMessageStatus;
  createdAt: string;
  readAt?: string;
  senderName: string;
  senderGroup?: string;
  recipientName: string;
}
