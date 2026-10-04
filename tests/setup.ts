import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// /schedule səhifəsi böyük timetable.json-u ilk dəfə lazy yükləyir; yavaş maşınlarda 1 san. limit kifayət etmir.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());

if (!window.matchMedia) {
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
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
window.scrollTo = (() => {}) as typeof window.scrollTo;
