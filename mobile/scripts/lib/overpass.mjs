// Dev-time only: Overpass client with endpoint rotation + exponential backoff (5/10/20/40 s).
// Public Overpass instances return 429/502/504 under load; we rotate across three mirrors.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'Hara/1.0 (dataprep)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function overpass(query, label = 'overpass', { attempts = 5, timeoutMs = 200000 } = {}) {
  let lastErr;
  const backoff = [5000, 10000, 20000, 40000, 40000];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const url = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const t0 = Date.now();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: ctl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error('no elements');
      if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new Error(json.remark);
      console.log(`  ${label}: ${json.elements.length} elements (${((Date.now() - t0) / 1000).toFixed(1)}s, ${url})`);
      return json;
    } catch (err) {
      lastErr = err;
      const wait = backoff[Math.min(attempt, backoff.length - 1)];
      console.log(`  ${label}: attempt ${attempt + 1} via ${url} failed (${err.message}); retry in ${wait / 1000}s`);
      if (attempt < attempts - 1) await sleep(wait);
    }
  }
  throw lastErr;
}
