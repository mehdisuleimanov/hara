// Dev-time only: validates src/data/routes.json and prints a before/after table.
// Usage: node scripts/check-routes.mjs [--before=<git-ref|file>]   (default before = git ref "redesign")
// Exit code 1 when a hard check fails.
//   • every option starts ≤8 m from the origin pin and ends ≤8 m from its destination pin;
//     consecutive legs touch (≤8 m)
//   • no two kinds of the same destination share identical geometry
//   • 0 spurs (out-and-back loops) in any leg / scooter line
//   • metro legs are flagged underground and list ≥2 stations matching their ends
//   • walk legs have ≥3 points; scores are integers 5–97 with night ≤ day
//   • "safest" has the best night score vs "cheapest" (vs taxi: reported as a note)
//   • lastMeters (when present) is complete
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DESTINATIONS } from '../src/data/destinations.ts';

const toRad = (d) => (d * Math.PI) / 180;
function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const pts = (c) => {
  const o = [];
  for (let i = 0; i < c.length; i += 2) o.push([c[i], c[i + 1]]);
  return o;
};
const d2 = (a, b) => hav(a[0], a[1], b[0], b[1]);

/** out-and-back loops: the line returns (≤3 m) to a point it passed 6–400 m earlier */
export function spurs(p) {
  let n = 0;
  for (let i = 2; i < p.length; i++) {
    let acc = 0;
    for (let k = i - 1; k >= Math.max(0, i - 120); k--) {
      acc += d2(p[k], p[k + 1]);
      if (acc > 400) break;
      if (k <= i - 2 && acc > 6 && d2(p[k], p[i]) < 3) {
        n++;
        break;
      }
    }
  }
  return n;
}

function analyse(R, destCoords) {
  const m = { options: 0, maxStart: 0, maxEnd: 0, maxJoin: 0, identical: 0, spurs: 0, metroLegs: 0, metroFlagged: 0, metroStraight: 0, walkThin: 0, badScore: 0, safestOrder: 0, taxiBeatsSafest: 0, lastMeters: 0, lastMetersBad: 0, failures: [], notes: [] };
  const origin = [R.origin.lat, R.origin.lon];
  for (const [destId, opts] of Object.entries(R.options)) {
    const dest = destCoords[destId] ?? R.destCoords[destId];
    const geo = {};
    for (const o of opts) {
      m.options++;
      const legs = o.legs.map((l) => ({ ...l, p: pts(l.c) }));
      const start = d2(legs[0].p[0], origin);
      const end = d2(legs.at(-1).p.at(-1), [dest.lat, dest.lon]);
      m.maxStart = Math.max(m.maxStart, start);
      m.maxEnd = Math.max(m.maxEnd, end);
      if (start > 8) m.failures.push(`${o.id}: starts ${start.toFixed(0)} m from origin`);
      if (end > 8) m.failures.push(`${o.id}: ends ${end.toFixed(0)} m from destination`);
      for (let i = 1; i < legs.length; i++) {
        const g = d2(legs[i - 1].p.at(-1), legs[i].p[0]);
        m.maxJoin = Math.max(m.maxJoin, g);
        if (g > 8) m.failures.push(`${o.id}: legs ${i - 1}→${i} gap ${g.toFixed(0)} m`);
      }
      for (const l of legs) {
        const s = l.mode === 'metro' ? 0 : spurs(l.p);
        if (s) {
          m.spurs += s;
          m.failures.push(`${o.id}: ${s} spur(s) in ${l.mode} leg`);
        }
        if (l.mode === 'walk' && l.p.length < 3) {
          m.walkThin++;
          m.failures.push(`${o.id}: walk leg with ${l.p.length} points`);
        }
        if (l.mode === 'metro') {
          m.metroLegs++;
          const st = l.stations ?? [];
          const ok = l.underground === true && st.length >= 2 && d2([st[0].lat, st[0].lon], l.p[0]) < 40 && d2([st.at(-1).lat, st.at(-1).lon], l.p.at(-1)) < 40;
          if (ok) m.metroFlagged++;
          else m.failures.push(`${o.id}: metro leg not flagged underground/stations`);
          if (l.p.length <= Math.max(2, st.length)) m.metroStraight++;
        }
      }
      for (const v of [o.scoreDay, o.scoreNight])
        if (!Number.isInteger(v) || v < 5 || v > 97) {
          m.badScore++;
          m.failures.push(`${o.id}: score ${v}`);
        }
      if (o.scoreNight > o.scoreDay) {
        m.badScore++;
        m.failures.push(`${o.id}: night > day`);
      }
      if (o.lastMeters) {
        m.lastMeters++;
        const lm = o.lastMeters;
        const ok = typeof lm.wrongSide === 'boolean' && lm.directC?.length >= 4 && lm.safeC?.length >= 4 && lm.note && lm.lanes >= 1 && lm.drop && typeof lm.extraM === 'number';
        if (!ok) {
          m.lastMetersBad++;
          m.failures.push(`${o.id}: incomplete lastMeters`);
        }
      }
      geo[o.kind] = legs.flatMap((l) => l.p);
    }
    const kinds = Object.keys(geo);
    for (let i = 0; i < kinds.length; i++)
      for (let j = i + 1; j < kinds.length; j++) {
        const a = geo[kinds[i]], b = geo[kinds[j]];
        if (a.length === b.length && a.every((p, k) => d2(p, b[k]) < 1)) {
          m.identical++;
          m.failures.push(`${destId}: ${kinds[i]} and ${kinds[j]} have identical geometry`);
        }
      }
    const by = Object.fromEntries(opts.map((o) => [o.kind, o]));
    if (by.safest && by.cheapest && by.safest.scoreNight < by.cheapest.scoreNight) {
      m.safestOrder++;
      m.failures.push(`${destId}: safest night ${by.safest.scoreNight} < cheapest ${by.cheapest.scoreNight}`);
    }
    if (by.safest && by.fastest && by.safest.scoreNight < by.fastest.scoreNight) {
      m.taxiBeatsSafest++;
      m.notes.push(`${destId}: taxi door-to-door night ${by.fastest.scoreNight} > safest ${by.safest.scoreNight} (pedestrian-exposure model)`);
    }
  }
  for (const k of ['seafront', 'calm']) {
    const s = R.scooter?.[k] ? spurs(pts(R.scooter[k].c)) : 0;
    if (s) {
      m.spurs += s;
      m.failures.push(`scooter ${k}: ${s} spur(s)`);
    }
  }
  for (const l of R.accessible?.legs ?? []) {
    if (l.mode !== 'metro') continue;
    m.metroLegs++;
    if (l.underground && l.stations?.length >= 2) m.metroFlagged++;
    else m.failures.push('accessible: metro leg not flagged');
    if (pts(l.c).length <= Math.max(2, l.stations?.length ?? 0)) m.metroStraight++;
  }
  return m;
}

async function loadBefore(arg) {
  try {
    if (arg && (await fs.stat(arg).catch(() => null))) return JSON.parse(await fs.readFile(arg, 'utf8'));
    const ref = arg || 'redesign';
    return JSON.parse(execSync(`git show ${ref}:mobile/src/data/routes.json`, { maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    return null;
  }
}

async function main() {
  const after = JSON.parse(await fs.readFile(path.resolve('src/data/routes.json'), 'utf8'));
  const beforeArg = process.argv.find((a) => a.startsWith('--before='))?.slice(9);
  const before = await loadBefore(beforeArg);
  const pins = Object.fromEntries(DESTINATIONS.map((d) => [d.id, { lat: d.lat, lon: d.lon }]));
  const A = analyse(after, pins);
  const B = before ? analyse(before, before.destCoords) : null;
  const drift = DESTINATIONS.filter((d) => after.destCoords[d.id] && d2([d.lat, d.lon], [after.destCoords[d.id].lat, after.destCoords[d.id].lon]) > 1).map((d) => d.id);
  if (drift.length) A.failures.push(`destinations.ts and routes.json destCoords differ: ${drift.join(', ')}`);

  const rows = [
    ['options', 'options'],
    ['max start gap (m)', 'maxStart', 1],
    ['max end gap (m)', 'maxEnd', 1],
    ['max gap between legs (m)', 'maxJoin', 1],
    ['identical geometry pairs', 'identical'],
    ['spurs', 'spurs'],
    ['metro legs', 'metroLegs'],
    ['  flagged underground+stations', 'metroFlagged'],
    ['  straight station-to-station', 'metroStraight'],
    ['walk legs < 3 points', 'walkThin'],
    ['invalid scores', 'badScore'],
    ['safest worse than cheapest (night)', 'safestOrder'],
    ['taxi beats safest (night, note)', 'taxiBeatsSafest'],
    ['options with lastMeters', 'lastMeters'],
  ];
  const fmt = (m, k, dec) => (m ? (dec ? m[k].toFixed(0) : String(m[k])) : '-');
  console.log('\ncheck                               before     after');
  console.log('----------------------------------  ---------  ---------');
  for (const [label, k, dec] of rows) console.log(`${label.padEnd(36)}${fmt(B, k, dec).padEnd(11)}${fmt(A, k, dec)}`);
  console.log('\nscores s/c/f day/night     before                         after');
  for (const id of Object.keys(after.options)) {
    const f = (R) => (R?.options[id] ?? []).map((o) => `${o.kind[0]}${o.scoreDay}/${o.scoreNight}`).join(' ');
    console.log(`  ${id.padEnd(14)}${f(before).padEnd(31)}${f(after)}`);
  }
  for (const n of A.notes) console.log('note: ' + n);
  if (A.failures.length) {
    console.log(`\nFAIL (${A.failures.length}):`);
    for (const f of A.failures) console.log('  x ' + f);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
