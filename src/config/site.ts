export const SITE_NAME = 'Sosial İş';

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
export const DEVELOPER = { label: 'Developed by', name: 'Feqan Gəraylı', url: 'https://feqan.dev' } as const;
