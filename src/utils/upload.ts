/** Fayl yükləmə yoxlamaları (frontend). Eyni qaydalar serverdə Storage bucket + siyasət + tətiklə də tətbiq olunur. */

export class UploadError extends Error {
  code = 'upload-invalid';
  constructor(message: string) { super(message); this.name = 'UploadError'; }
}

export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type MaterialExt = 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'txt' | 'zip';

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

const MATERIAL_RULES: Record<MaterialExt, { mimes: string[]; magic?: number[]; type: 'pdf' | 'doc' | 'ppt' | 'xls' | 'txt' | 'zip' }> = {
  pdf: { mimes: ['application/pdf'], magic: PDF, type: 'pdf' },
  doc: { mimes: ['application/msword'], magic: OLE, type: 'doc' },
  docx: { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: ZIP, type: 'doc' },
  ppt: { mimes: ['application/vnd.ms-powerpoint'], magic: OLE, type: 'ppt' },
  pptx: { mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], magic: ZIP, type: 'ppt' },
  xls: { mimes: ['application/vnd.ms-excel'], magic: OLE, type: 'xls' },
  xlsx: { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: ZIP, type: 'xls' },
  txt: { mimes: ['text/plain'], type: 'txt' },
  zip: { mimes: ['application/zip', 'application/x-zip-compressed'], magic: ZIP, type: 'zip' },
};

export const MATERIAL_ACCEPT = Object.keys(MATERIAL_RULES).map((e) => `.${e}`).join(',');
export const MATERIAL_FORMATS_LABEL = 'PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP';

const PHOTO_RULES: Record<string, { mime: string; magic: number[] | 'riff' }> = {
  jpg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  png: { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  webp: { mime: 'image/webp', magic: 'riff' },
};
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';

export const extOf = (name: string) => {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
};

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

async function head(file: File, n = 4096): Promise<Uint8Array> {
  const slice = file.slice(0, n);
  const buf = typeof slice.arrayBuffer === 'function'
    ? await slice.arrayBuffer()
    : await new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(slice); });
  return new Uint8Array(buf);
}

export interface CheckedMaterial { ext: MaterialExt; fileType: 'pdf' | 'doc' | 'ppt' | 'xls' | 'txt' | 'zip'; mime: string }

/** Uzantı, MIME və faylın ilk baytları (magic bytes) birlikdə yoxlanılır; yalnız uzantıya güvənilmir. */
export async function checkMaterialFile(file: File): Promise<CheckedMaterial> {
  const ext = extOf(file.name) as MaterialExt;
  const rule = MATERIAL_RULES[ext];
  if (!rule) throw new UploadError(`Bu fayl tipi dəstəklənmir. İcazə verilənlər: ${MATERIAL_FORMATS_LABEL}.`);
  if (file.size < 1) throw new UploadError('Fayl boşdur.');
  if (file.size > MAX_MATERIAL_BYTES) throw new UploadError('Fayl 25 MB-dan böyük ola bilməz.');
  if (file.name.length > 180) throw new UploadError('Fayl adı çox uzundur (ən çox 180 simvol).');
  if (file.type && !rule.mimes.includes(file.type.toLowerCase())) throw new UploadError('Faylın tipi uzantısına uyğun gəlmir.');
  const bytes = await head(file);
  if (rule.magic ? !startsWith(bytes, rule.magic) : bytes.includes(0)) throw new UploadError('Faylın məzmunu uzantısına uyğun gəlmir.');
  return { ext, fileType: rule.type, mime: rule.mimes[0] };
}

export async function checkPhotoFile(file: File): Promise<{ ext: 'jpg' | 'png' | 'webp'; mime: string }> {
  const raw = extOf(file.name);
  const rule = PHOTO_RULES[raw];
  if (!rule) throw new UploadError('Şəkil JPG, PNG və ya WEBP formatında olmalıdır.');
  if (file.size < 1) throw new UploadError('Şəkil faylı boşdur.');
  if (file.size > MAX_PHOTO_BYTES) throw new UploadError('Şəkil 2 MB-dan böyük ola bilməz.');
  if (file.type && file.type.toLowerCase() !== rule.mime) throw new UploadError('Şəklin tipi uzantısına uyğun gəlmir.');
  const b = await head(file, 16);
  const ok = rule.magic === 'riff'
    ? startsWith(b, [0x52, 0x49, 0x46, 0x46]) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    : startsWith(b, rule.magic);
  if (!ok) throw new UploadError('Şəklin məzmunu uzantısına uyğun gəlmir.');
  return { ext: raw === 'jpeg' ? 'jpg' : (raw as 'jpg' | 'png' | 'webp'), mime: rule.mime };
}

export function formatBytes(n: number | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Storage xətasını istifadəçi üçün aydın Azərbaycan mesajına çevirir. */
export function friendlyUploadMessage(err: unknown): string {
  const e = (typeof err === 'object' && err ? err : {}) as { message?: unknown; statusCode?: unknown; status?: unknown };
  const msg = String(e.message ?? '').toLowerCase();
  const code = String(e.statusCode ?? e.status ?? '');
  if (/mime|not supported|invalid_mime/.test(msg)) return 'Server bu fayl tipini qəbul etmədi.';
  if (/size|too large|exceed/.test(msg) || code === '413') return 'Fayl serverin icazə verdiyi ölçüdən böyükdür.';
  if (/row-level security|unauthorized|not allowed|forbidden/.test(msg) || code === '403' || code === '401') return 'Fayl yükləmək üçün icazəniz yoxdur.';
  if (/failed to fetch|network|load failed/.test(msg)) return 'Şəbəkə xətası. Fayl yüklənmədi, yenidən cəhd edin.';
  if (/bucket not found/.test(msg)) return 'Fayl anbarı hələ qurulmayıb. Supabase miqrasiyalarını işə salın.';
  return 'Fayl yüklənə bilmədi. Bir az sonra yenidən cəhd edin.';
}
