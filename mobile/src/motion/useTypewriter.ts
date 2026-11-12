import { useEffect, useState } from 'react';
import { prefs } from '@/store/prefs';

/** Reveals `text` progressively (chars per second). Returns [shown, done]. */
export function useTypewriter(text: string, cps = 60): [string, boolean] {
  const [n, setN] = useState(prefs().liteFx ? text.length : 0);
  useEffect(() => {
    if (prefs().liteFx || !text) {
      setN(text.length);
      return;
    }
    setN(0);
    const step = Math.max(1, Math.round(cps / 30));
    const id = setInterval(() => {
      setN((v) => {
        const next = Math.min(text.length, v + step);
        if (next >= text.length) clearInterval(id);
        return next;
      });
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [text, cps]);
  return [text.slice(0, n), n >= text.length];
}
