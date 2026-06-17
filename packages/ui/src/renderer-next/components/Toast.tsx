import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';

type Tone = 'default' | 'ok' | 'danger';
interface ToastItem {
  id: number;
  msg: string;
  tone: Tone;
}
interface ToastApi {
  push: (msg: string, tone?: Tone) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', t.tone !== 'default' && `toast--${t.tone}`)}>
            <span className={cx('lamp', t.tone === 'danger' ? 'lamp--danger' : t.tone === 'ok' ? 'lamp--ok' : 'lamp--on')} aria-hidden />
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(Ctx) ?? { push: () => undefined };
}
