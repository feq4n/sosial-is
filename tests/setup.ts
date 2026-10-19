import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// /schedule səhifəsi böyük timetable.json-u ilk dəfə lazy yükləyir; yavaş maşınlarda 1 san. limit kifayət etmir.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());

// Node mühitində işləyən testlər (məs. api/chat.ts) üçün brauzer təqlidləri yalnız window varsa qurulur
const hasWindow = typeof window !== 'undefined';

if (hasWindow && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
if (hasWindow) {
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}
