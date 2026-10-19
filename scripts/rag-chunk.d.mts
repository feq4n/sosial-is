export interface ChunkOptions { size?: number; overlap?: number; min?: number }
export function normalizeText(input: unknown): string;
export function chunkText(text: string, opts?: ChunkOptions): string[];
export function chunkPages(pages: { page: number | null; text: string }[], opts?: ChunkOptions): { page: number | null; content: string }[];
