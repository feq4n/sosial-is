import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
