import { LogoMark } from './Logo';

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Yüklənir">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-12 animate-pulse" />
        <span className="text-sm text-muted">Yüklənir…</span>
      </div>
    </div>
  );
}
