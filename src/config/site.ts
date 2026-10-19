export const SITE_NAME = 'Sosial İş';

/** Saytın rəsmi ünvanı. Bütün mütləq URL-lər (canonical, og:url, og:image, sitemap) bu domendən qurulur. */
export const SITE_URL = 'https://sosial-is.info';
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const OG_IMAGE_ALT = 'Azərbaycan Dövlət Pedaqoji Kolleci loqosu';

/** Axtarış sistemlərinə açıq olmamalı yollar (şəxsi və ya idarəetmə səhifələri). */
export const PRIVATE_PATH_RE = /^\/(admin|dashboard|login|register|forgot-password|reset-password|f)(\/|$)/;

export const contact = {
  email: import.meta.env.VITE_CONTACT_EMAIL as string | undefined,
  phone: import.meta.env.VITE_CONTACT_PHONE as string | undefined,
  address: import.meta.env.VITE_CONTACT_ADDRESS as string | undefined,
};

export const hasContactInfo = Boolean(contact.email || contact.phone || contact.address);

/**
 * Developer məlumatı KODDA sabitdir: verilənlər bazasında və admin panelində deyil,
 * ona görə admin paneli ilə dəyişdirilə və ya silinə bilməz.
 */
export const DEVELOPER = { label: 'Developed by', name: 'Feqan Gəraylı', url: 'https://feqandev.com' } as const;

/**
 * Sosial İş AI hələ hazır deyil: yalnız admin və super admin istifadə edə bilir, qalanları "tezliklə" xəbərdarlığı görür.
 * Hamıya açmaq üçün: VITE_CHAT_PUBLIC=true (brauzer) və CHAT_PUBLIC=true (server, Vercel) təyin edib yenidən deploy edin.
 */
export const CHAT_PUBLIC = import.meta.env.VITE_CHAT_PUBLIC === 'true';
