import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(err, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-center text-ink">
        <div>
          <h1 className="text-2xl font-extrabold">Gözlənilməz xəta baş verdi</h1>
          <p className="mt-2 text-muted">Səhifəni yeniləyib yenidən cəhd edin.</p>
          <button className="mt-5 h-11 rounded-xl bg-brand px-5 font-semibold text-brand-ink" onClick={() => location.reload()}>Səhifəni yenilə</button>
        </div>
      </div>
    );
  }
}
