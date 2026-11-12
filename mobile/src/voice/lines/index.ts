import { COMMON_LINES } from './common';
import { AHMED_LINES } from './ahmed';
import { NAV_LINES } from './nav';
import { A11Y_LINES } from './a11y';
import { SCAN_LINES } from './scan';
import { BRAND_LINES } from './brand';

/** Every line that should ship as a pre-generated clip (deduplicated). */
export function allLines(): string[] {
  return Array.from(new Set([...COMMON_LINES, ...AHMED_LINES, ...NAV_LINES, ...A11Y_LINES, ...SCAN_LINES, ...BRAND_LINES].map((s) => s.trim()).filter(Boolean)));
}
