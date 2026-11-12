import React, { useEffect, useState } from 'react';
import type { TextStyle, StyleProp } from 'react-native';
import { Txt } from '@/components/ui';
import type { TypeVariant } from '@/theme';
import { prefs } from '@/store/prefs';

/** rAF count-up; cheap for a handful of numbers on screen. */
export function useCountUp(target: number, opts: { duration?: number; delay?: number } = {}) {
  const { duration = 900, delay = 0 } = opts;
  const [val, setVal] = useState(prefs().liteFx ? target : 0);
  useEffect(() => {
    if (prefs().liteFx) {
      setVal(target);
      return;
    }
    let raf = 0;
    let from = 0;
    setVal((v) => {
      from = v;
      return v;
    });
    const t0 = setTimeout(() => {
      const start = Date.now();
      const step = () => {
        const p = Math.min(1, (Date.now() - start) / duration);
        setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(t0);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return val;
}

/** Counter rendered through Txt (inherits a11y scaling + HC colors). */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  v = 'num',
  color,
  size,
  duration,
  delay,
  style,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  v?: TypeVariant;
  color?: string;
  size?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const n = useCountUp(value, { duration, delay });
  const txt = n.toFixed(decimals).replace('.', ',');
  const grouped = decimals === 0 ? Math.round(n).toLocaleString('en-US').replace(/,/g, ' ') : txt;
  return (
    <Txt v={v} color={color} size={size} style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {prefix}
      {grouped}
      {suffix}
    </Txt>
  );
}
