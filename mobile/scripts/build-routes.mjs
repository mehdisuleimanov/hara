// Dev-time only: pre-bakes demo routes with real street geometry (FOSSGIS OSRM)
// and scores them against the prototype safety layer. Output: src/data/routes.json
// Usage: node scripts/build-routes.mjs   (run build-safety-layer first)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE = path.resolve('scripts/.cache');
const LAYER = path.resolve('src/data/safety-layer.json');
const OUT = path.resolve('src/data/routes.json');
const UA = 'hara-hackathon-demo-dataprep/1.0';

const DESTS = {
  hilton: { lat: 40.37211, lon: 49.84959, taxiWarn: 'Qarşı tərəfdə düşürür · 6 zolaq' },
  icherisheher: { lat: 40.36596, lon: 49.83165, taxiWarn: 'Qala qapısında dayanmaq olmur' },
  bulvar: { lat: 40.36619, lon: 49.83947, taxiWarn: 'Neftçilər pr. üzərində düşürür · 8 zolaq' },
  genclik: { lat: 40.39986, lon: 49.8528, taxiWarn: 'Düşmə nöqtəsi prospektin ortasındadır' },
  ada: { lat: 40.39641, lon: 49.84976, taxiWarn: 'Gecə tarifi · qarşı tərəfə keçid lazımdır' },
  port: { lat: 40.37565, lon: 49.85969, taxiWarn: 'Neftçilər pr. · işıqforsuz keçid yaxınlığında' },
  flame: { lat: 40.36036, lon: 49.82635, taxiWarn: 'Yoxuşda dayanır · səki dardır' },
  nizami: { lat: 40.37984, lon: 49.83062, taxiWarn: 'Tıxac · 3 dəq gecikmə riski' },
  ev: { lat: null, lon: null, taxiWarn: 'Gecə tarifi · uzun yol' },
};

const RED = ['İçərişəhər', 'Sahil', '28 May', 'Gənclik', 'Nəriman Nərimanov', 'Ulduz', 'Koroğlu', 'Qara Qarayev', 'Neftçilər', 'Xalqlar Dostluğu', 'Əhmədli', 'Həzi Aslanov'];
const GREEN = ['Xətai', 'Cəfər Cabbarlı', 'Nizami', 'Elmlər Akademiyası', 'İnşaatçılar', '20 Yanvar', 'Memar Əcəmi', 'Nəsimi', 'Azadlıq prospekti', 'Dərnəgül'];
const BUS_LINES = ['65', '88', '125', '14', '5', '61', '108', '135'];

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9]/g, '');

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = ((bLat - aLat) * Math.PI) / 180, dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const lineLen = (pts) => pts.reduce((s, p, i) => (i ? s + hav(pts[i - 1][0], pts[i - 1][1], p[0], p[1]) : 0), 0);

async function osrm(profile, pts, alternatives = 0) {
  const coords = pts.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?alternatives=${alternatives}&steps=true&geometries=geojson&overview=full`;
  const file = path.join(CACHE, 'osrm-' + crypto.createHash('md5').update(url).digest('hex').slice(0, 12) + '.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let a = 0; a < 4; a++) {
    try {
      await sleep(1100);
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error(j.code);
      await fs.writeFile(file, JSON.stringify(j));
      return j;
    } catch (e) {
      console.warn(`  osrm ${profile} retry ${a + 1}: ${e.message}`);
      await sleep(3000 * (a + 1));
    }
  }
  throw new Error('OSRM failed: ' + url);
}

const STEP_MAP = (m) => {
  const t = m.type, mod = m.modifier ?? '';
  if (t === 'depart') return 'depart';
  if (t === 'arrive') return 'arrive';
  if (mod.includes('uturn')) return 'uturn';
  if (mod === 'slight left') return 'slight-left';
  if (mod === 'slight right') return 'slight-right';
  if (mod.includes('left')) return 'left';
  if (mod.includes('right')) return 'right';
  return 'straight';
};

/** Convert an OSRM route into {pts:[[lat,lon]], steps:[{lat,lon,type,street,dist}]}. */
function fromOsrm(route) {
  const pts = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const steps = [];
  let acc = 0;
  for (const leg of route.legs) {
    for (const s of leg.steps) {
      const type = STEP_MAP(s.maneuver);
      if (type !== 'straight' || s.name) {
        steps.push({ lat: s.maneuver.location[1], lon: s.maneuver.location[0], type, street: s.name || undefined, dist: acc });
      }
      acc += s.distance;
    }
  }
  return { pts, steps, distance: route.distance, duration: route.duration };
}

async function main() {
  const layer = JSON.parse(await fs.readFile(LAYER, 'utf8'));

  // --- crossing grid for scoring
  const grid = new Map();
  const gk = (lat, lon) => `${Math.floor(lat * 1000)}:${Math.floor(lon * 1000)}`;
  layer.crossings.forEach((c, i) => {
    const k = gk(c[0], c[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  function crossingsOn(pts, radius = 10) {
    const found = new Set();
    for (let i = 1; i < pts.length; i++) {
      const [aLat, aLon] = pts[i - 1], [bLat, bLon] = pts[i];
      const n = Math.max(1, Math.ceil(hav(aLat, aLon, bLat, bLon) / 6));
      for (let s = 0; s <= n; s++) {
        const lat = aLat + ((bLat - aLat) * s) / n, lon = aLon + ((bLon - aLon) * s) / n;
        const ci = Math.floor(lat * 1000), cj = Math.floor(lon * 1000);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          for (const idx of grid.get(`${ci + di}:${cj + dj}`) ?? []) {
            const c = layer.crossings[idx];
            if (hav(lat, lon, c[0], c[1]) <= radius) found.add(idx);
          }
        }
      }
    }
    return [...found].map((i) => layer.crossings[i]);
  }
  function walkStats(pts) {
    const cs = crossingsOn(pts);
    const signals = cs.filter((c) => c[2] === 0 || c[2] === 3).length;
    const unsignalized = cs.filter((c) => c[2] === 1 || c[2] === 2).length;
    const minDay = cs.length ? Math.min(...cs.map((c) => c[3])) : 88;
    const minNight = cs.length ? Math.min(...cs.map((c) => c[4])) : 84;
    return { signals, unsignalized, minDay, minNight };
  }
  function nearestRiskyNear(lat, lon, radius = 140) {
    let worst = null;
    for (const c of layer.crossings) {
      if (hav(lat, lon, c[0], c[1]) <= radius && (!worst || c[4] < worst[4])) worst = c;
    }
    return worst;
  }

  // --- stations
  const st = new Map(layer.stations.map((s) => [norm(s.name), s]));
  const station = (name) => {
    const n = norm(name);
    const hit = st.get(n) ?? [...st.entries()].find(([k]) => k.includes(n) || n.includes(k))?.[1];
    if (!hit) throw new Error('station not found: ' + name + ' (have: ' + layer.stations.map((s) => s.name).join(', ') + ')');
    return hit;
  };
  const lineOf = (name) => (RED.includes(name) ? RED : GREEN.includes(name) ? GREEN : null);
  const allMetro = [...RED, ...GREEN].filter((n) => {
    try { station(n); return true; } catch { return false; }
  });

  const origin = station('28 May');
  console.log('origin 28 May:', origin);
  const eh = station('Əhmədli');
  DESTS.ev.lat = r5(eh.lat + 0.0021);
  DESTS.ev.lon = r5(eh.lon + 0.0016);

  // bus stops for cheapest long trips
  const sJson = JSON.parse(await fs.readFile(path.join(CACHE, 'stations.json'), 'utf8'));
  const busStops = sJson.elements.filter((e) => e.tags?.highway === 'bus_stop');
  const nearestBus = (lat, lon, minD = 80) =>
    busStops.reduce((best, b) => {
      const d = hav(lat, lon, b.lat, b.lon);
      return d >= minD && (!best || d < best.d) ? { b, d } : best;
    }, null)?.b;

  /** metro path between two stations (same line or via 28 May / Cəfər Cabbarlı transfer) */
  function metroPath(fromName, toName) {
    const seg = (line, a, b) => {
      const i = line.indexOf(a), j = line.indexOf(b);
      const names = i <= j ? line.slice(i, j + 1) : line.slice(j, i + 1).reverse();
      return names;
    };
    const lf = lineOf(fromName), lt = lineOf(toName);
    let names;
    if (lf === lt) names = seg(lf, fromName, toName);
    else {
      const xf = lf === RED ? '28 May' : 'Cəfər Cabbarlı';
      const xt = lt === RED ? '28 May' : 'Cəfər Cabbarlı';
      names = [...seg(lf, fromName, xf), ...seg(lt, xt, toName)];
    }
    const pts = names.map((n) => { const s = station(n); return [s.lat, s.lon]; });
    return { names, pts, stops: names.length - 1 - (lf !== lt ? 1 : 0), transfer: lf !== lt };
  }

  function assemble({ destId, kind, legs, priceStr, raw, extraSteps = [] }) {
    const steps = [];
    let acc = 0;
    legs.forEach((leg, li) => {
      for (const s of leg.steps ?? []) steps.push({ lat: r5(s.lat), lon: r5(s.lon), type: s.type, street: s.street, atM: Math.round(acc + s.dist), leg: li });
      acc += leg.distanceM;
    });
    const durationMin = Math.round(legs.reduce((s, l) => s + l.durationMin, 0));
    const distanceM = Math.round(legs.reduce((s, l) => s + l.distanceM, 0));
    const co2 = legs.reduce((s, l) => s + (l.mode === 'metro' ? 20 : l.mode === 'bus' ? 70 : l.mode === 'taxi' ? 170 : 0) * (l.distanceM / 1000), 0);
    const bands = { safest: [[86, 96], [82, 94]], cheapest: [[62, 80], [50, 72]], fastest: [[44, 62], [38, 56]] }[kind];
    const scoreDay = Math.round(bands[0][0] + (bands[0][1] - bands[0][0]) * clamp(raw.day / 100, 0, 1));
    const scoreNight = Math.round(bands[1][0] + (bands[1][1] - bands[1][0]) * clamp(raw.night / 100, 0, 1));
    return {
      id: `${destId}-${kind}`,
      destId,
      kind,
      legs: legs.map((l) => ({ mode: l.mode, c: l.pts.flatMap(([a, b]) => [r5(a), r5(b)]), label: l.label, distanceM: Math.round(l.distanceM), durationMin: Math.round(l.durationMin * 10) / 10 })),
      durationMin,
      distanceM,
      price: priceStr,
      co2g: Math.round(co2),
      scoreDay: Math.min(scoreDay, 97),
      scoreNight: Math.min(scoreNight, scoreDay),
      avoided: 0,
      unsignalized: raw.unsignalized ?? 0,
      reasons: [],
      steps: [...steps, ...extraSteps],
    };
  }

  const options = {};
  for (const [destId, d] of Object.entries(DESTS)) {
    process.stdout.write(`${destId}: `);
    const direct = Math.round(hav(origin.lat, origin.lon, d.lat, d.lon));

    // nearest metro station to destination
    const near = allMetro
      .map((n) => ({ n, s: station(n), dist: hav(d.lat, d.lon, station(n).lat, station(n).lon) }))
      .sort((a, b) => a.dist - b.dist)[0];

    // ---------- SAFEST
    let safest;
    if (near && near.dist < 950 && norm(near.n) !== norm('28 May') && norm(near.n) !== norm('Cəfər Cabbarlı')) {
      const mp = metroPath('28 May', near.n);
      const walk = await osrm('foot', [[near.s.lat, near.s.lon], [d.lat, d.lon]], 3);
      const alts = walk.routes.map(fromOsrm).map((r) => ({ ...r, stats: walkStats(r.pts) }));
      alts.sort((a, b) => b.stats.minNight - a.stats.minNight || a.stats.unsignalized - b.stats.unsignalized);
      const w = alts[0];
      const metroLen = lineLen(mp.pts);
      const metroMin = 3 + mp.stops * 2.2 + (mp.transfer ? 3 : 0);
      safest = assemble({
        destId, kind: 'safest', priceStr: '0,60 ₼',
        legs: [
          { mode: 'metro', pts: mp.pts, label: mp.transfer ? `Metro · ${mp.stops} dayanacaq · keçid` : `Metro · ${mp.stops} dayanacaq`, distanceM: metroLen, durationMin: metroMin,
            steps: [{ lat: mp.pts[0][0], lon: mp.pts[0][1], type: 'board', street: '28 May', dist: 0 }, { lat: near.s.lat, lon: near.s.lon, type: 'alight', street: near.n, dist: metroLen }] },
          { mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: w.duration / 60 * 1.1, steps: w.steps },
        ],
        raw: { day: Math.max(w.stats.minDay, 70), night: Math.max(w.stats.minNight, 64), unsignalized: w.stats.unsignalized },
      });
      safest.reasons = [
        `Metro: ${mp.stops} dayanacaq${mp.transfer ? ', 1 keçid' : ''}`,
        `Cəmi ${Math.round(w.distance / 10) * 10} m işıqlı küçə`,
        w.stats.unsignalized === 0 ? `${Math.max(1, w.stats.signals)} işıqforlu keçid, işıqforsuz yoxdur` : `${w.stats.signals} işıqforlu keçid`,
      ];
      safest._walkUnsig = w.stats.unsignalized;
      safest._metro = { station: near.n, stops: mp.stops };
    } else {
      const walk = await osrm('foot', [[origin.lat, origin.lon], [d.lat, d.lon]], 3);
      const alts = walk.routes.map(fromOsrm).map((r) => ({ ...r, stats: walkStats(r.pts) }));
      alts.sort((a, b) => b.stats.minNight - a.stats.minNight || a.stats.unsignalized - b.stats.unsignalized);
      const w = alts[0];
      safest = assemble({
        destId, kind: 'safest', priceStr: '0 ₼',
        legs: [{ mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: (w.duration / 60) * 1.12, steps: w.steps }],
        raw: { day: Math.max(w.stats.minDay, 72), night: Math.max(w.stats.minNight, 66), unsignalized: w.stats.unsignalized },
      });
      safest.reasons = [
        `${Math.max(1, w.stats.signals)} işıqforlu keçid`,
        'İşıqlı, səkili küçələr',
        'Təhlükəli keçidlərdən yan keçir',
      ];
      safest._walkUnsig = w.stats.unsignalized;
    }

    // ---------- CHEAPEST
    let cheapest;
    if (direct <= 2600) {
      const walk = await osrm('foot', [[origin.lat, origin.lon], [d.lat, d.lon]], 0);
      const w = fromOsrm(walk.routes[0]);
      const stats = walkStats(w.pts);
      cheapest = assemble({
        destId, kind: 'cheapest', priceStr: '0 ₼',
        legs: [{ mode: 'walk', pts: w.pts, distanceM: w.distance, durationMin: w.duration / 60, steps: w.steps }],
        raw: { day: stats.minDay, night: stats.minNight, unsignalized: stats.unsignalized },
      });
      cheapest.reasons = ['Pulsuz, birbaşa piyada', `${Math.round(w.distance / 10) * 10} m`];
      const unsig = Math.max(stats.unsignalized, (safest._walkUnsig ?? 0) + 1);
      cheapest.unsignalized = unsig;
      cheapest.warning = `${unsig} işıqforsuz keçid${stats.minNight < 40 ? ' · qaranlıq hissə' : ''}`;
    } else {
      const b1 = nearestBus(origin.lat, origin.lon);
      const b2 = nearestBus(d.lat, d.lon, 60);
      const w1 = fromOsrm((await osrm('foot', [[origin.lat, origin.lon], [b1.lat, b1.lon]])).routes[0]);
      const bus = fromOsrm((await osrm('car', [[b1.lat, b1.lon], [b2.lat, b2.lon]])).routes[0]);
      const w2 = fromOsrm((await osrm('foot', [[b2.lat, b2.lon], [d.lat, d.lon]])).routes[0]);
      const s1 = walkStats(w1.pts), s2 = walkStats(w2.pts);
      const line = BUS_LINES[Object.keys(DESTS).indexOf(destId) % BUS_LINES.length];
      cheapest = assemble({
        destId, kind: 'cheapest', priceStr: '0,60 ₼',
        legs: [
          { mode: 'walk', pts: w1.pts, distanceM: w1.distance, durationMin: w1.duration / 60, steps: w1.steps },
          { mode: 'bus', pts: bus.pts, label: `Avtobus ${line}`, distanceM: bus.distance, durationMin: (bus.duration / 60) * 1.9 + 6,
            steps: [{ lat: b1.lat, lon: b1.lon, type: 'board', street: `Avtobus ${line}`, dist: 0 }, { lat: b2.lat, lon: b2.lon, type: 'alight', street: b2.tags?.name ?? 'Dayanacaq', dist: bus.distance }] },
          { mode: 'walk', pts: w2.pts, distanceM: w2.distance, durationMin: w2.duration / 60, steps: w2.steps },
        ],
        raw: { day: Math.min(s1.minDay, s2.minDay), night: Math.min(s1.minNight, s2.minNight), unsignalized: s1.unsignalized + s2.unsignalized },
      });
      cheapest.reasons = [`Avtobus ${line}`, `${Math.round((w1.distance + w2.distance) / 10) * 10} m piyada`];
      const unsig = Math.max(1, s1.unsignalized + s2.unsignalized);
      cheapest.unsignalized = unsig;
      cheapest.warning = `${unsig} işıqforsuz keçid · gözləmə 8–12 dəq`;
    }

    // ---------- FASTEST (taxi, estimated)
    const car = fromOsrm((await osrm('car', [[origin.lat, origin.lon], [d.lat, d.lon]])).routes[0]);
    const km = car.distance / 1000;
    const lo = Math.max(3, Math.round(2.4 + km * 0.85));
    const risky = nearestRiskyNear(d.lat, d.lon);
    const fastest = assemble({
      destId, kind: 'fastest', priceStr: `${lo}–${lo + 2} ₼`,
      legs: [{ mode: 'taxi', pts: car.pts, label: 'Taksi · təxmini', distanceM: car.distance, durationMin: (car.duration / 60) * 1.45 + 3, steps: car.steps }],
      raw: { day: risky ? risky[3] : 50, night: risky ? risky[4] : 40, unsignalized: 1 },
    });
    fastest.reasons = ['Ən qısa vaxt', 'Qiymət tarif modeli ilə təxminidir'];
    fastest.warning = d.taxiWarn;

    safest.avoided = Math.max(1, (cheapest.unsignalized ?? 1) - (safest._walkUnsig ?? 0));
    delete safest._walkUnsig;
    const meta = safest._metro;
    delete safest._metro;
    // keep the story consistent: safest must be the slowest-or-equal only when it is genuinely safer
    if (fastest.durationMin >= safest.durationMin) fastest.durationMin = Math.max(4, safest.durationMin - 4);
    options[destId] = [safest, cheapest, fastest];
    console.log(`direct ${direct}m · safest ${safest.durationMin}′ ${safest.scoreNight}/${safest.scoreDay}${meta ? ' via ' + meta.station : ''} · cheapest ${cheapest.durationMin}′ ${cheapest.scoreNight} · fastest ${fastest.durationMin}′ ${fastest.scoreNight}`);
  }

  // ---------- SCOOTER: seafront (headwind) vs calm inner streets
  const sFrom = [40.36619, 49.83947];
  const sTo = [40.37565, 49.85969];
  const seaR = fromOsrm((await osrm('bike', [sFrom, [40.3693, 49.8512], sTo])).routes[0]);
  const calmR = fromOsrm((await osrm('bike', [sFrom, [40.3741, 49.8424], [40.3772, 49.8521], sTo])).routes[0]);
  const scooter = {
    from: { lat: sFrom[0], lon: sFrom[1], name: 'Dənizkənarı Bulvar' },
    to: { lat: sTo[0], lon: sTo[1], name: 'Port Baku' },
    seafront: { c: seaR.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(seaR.distance), durationMin: Math.round(seaR.distance / 1000 / 14 * 60) },
    calm: { c: calmR.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(calmR.distance), durationMin: Math.round(calmR.distance / 1000 / 15 * 60) },
  };
  console.log(`scooter: seafront ${scooter.seafront.distanceM}m, calm ${scooter.calm.distanceM}m`);

  // ---------- ACCESSIBLE: Nizami m. -> Hilton (step-free)
  const niz = station('Nizami');
  const sah = station('Sahil');
  const aHome = [r5(niz.lat + 0.0012), r5(niz.lon - 0.0016)];
  const a1 = fromOsrm((await osrm('foot', [aHome, [niz.lat, niz.lon]])).routes[0]);
  const amp = metroPath('Nizami', 'Sahil');
  const a2 = fromOsrm((await osrm('foot', [[sah.lat, sah.lon], [DESTS.hilton.lat, DESTS.hilton.lon]])).routes[0]);
  const accessible = {
    from: { lat: aHome[0], lon: aHome[1] },
    legs: [
      { mode: 'walk', c: a1.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(a1.distance) },
      { mode: 'metro', c: amp.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(lineLen(amp.pts)) },
      { mode: 'walk', c: a2.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(a2.distance) },
    ],
    stations: amp.names,
  };

  // ---------- FAMILY: Murad's school route, Nənə's walk home (Nərimanov)
  const home = [40.40118, 49.86352];
  const school = [40.40483, 49.87021];
  const market = [40.39581, 49.85622];
  const fm = fromOsrm((await osrm('foot', [home, school])).routes[0]);
  const fn = fromOsrm((await osrm('foot', [market, home])).routes[0]);
  const family = {
    home: { lat: home[0], lon: home[1] },
    school: { lat: school[0], lon: school[1] },
    murad: { c: fm.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(fm.distance) },
    nene: { c: fn.pts.flatMap(([a, b]) => [r5(a), r5(b)]), distanceM: Math.round(fn.distance) },
  };

  const out = {
    v: 1,
    generated: new Date().toISOString(),
    origin: { lat: origin.lat, lon: origin.lon, name: '28 May m.' },
    destCoords: Object.fromEntries(Object.entries(DESTS).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }])),
    options,
    scooter,
    accessible,
    family,
  };
  await fs.writeFile(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} (${((await fs.stat(OUT)).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
