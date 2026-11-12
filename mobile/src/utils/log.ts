/** Quiet diagnostics: never console.warn/error (those show LogBox banners in dev). */
export function log(...args: unknown[]) {
  if (__DEV__) console.log(...args);
}
