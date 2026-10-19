export interface ExtractedChunk { page: number | null; content: string }
export function extractPdf(bytes: Uint8Array): Promise<ExtractedChunk[]>;
export function extractDocx(bytes: Uint8Array): Promise<ExtractedChunk[]>;
export function extract(ext: string, bytes: Uint8Array): Promise<ExtractedChunk[] | null>;
