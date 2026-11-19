// Performance: winding (per-query full solid-angle sum) vs single-ray parity.
// warmup 1 + 10 reps, report cold start, min/median/p95/stddev -> result.json
import { writeFileSync } from 'node:fs';
import { boxMesh, holeMask, queryPoints, windingAt, rayParity } from '../src/core.mjs';

const base = boxMesh(8, 1);
const mask = holeMask(base, 0.70);
const mesh = { ...base, mask };
const pts = queryPoints(12345, 240);

function time(fn) {
  const t0 = process.hrtime.bigint();
  for (const p of pts) fn(p);
  return Number(process.hrtime.bigint() - t0) / 1e6; // ms per 480 queries
}

// cold start: no prior call to the target function in this process
const coldWinding = (() => { const t0 = process.hrtime.bigint(); for (const p of pts) windingAt(mesh, p, mask); return Number(process.hrtime.bigint() - t0) / 1e6; })();
const coldRay = (() => { const t0 = process.hrtime.bigint(); for (const p of pts) rayParity(mesh, p, undefined, mask); return Number(process.hrtime.bigint() - t0) / 1e6; })();

time(() => windingAt(mesh, [0, 0, 0], mask)); // warmup
time(() => rayParity(mesh, [0, 0, 0], undefined, mask));

const w = [], r = [];
for (let i = 0; i < 10; i++) { w.push(time((p) => windingAt(mesh, p, mask))); r.push(time((p) => rayParity(mesh, p, undefined, mask))); }

function stats(a) {
  const s = [...a].sort((x, y) => x - y);
  const med = s[Math.floor(s.length / 2)];
  const p95 = s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  const stddev = Math.sqrt(s.reduce((x, y) => x + (y - mean) ** 2, 0) / s.length);
  const rsd = mean === 0 ? 0 : stddev / mean;
  return { min: s[0], median: med, p95, stddev, rsd };
}

const ws = stats(w), rs = stats(r);
const ratio = ws.median && rs.median ? (ws.median / rs.median).toFixed(2) : '0';
const out = {
  method: 'winding vs single-ray parity per 480 queries',
  nSamples: w.length,
  points: pts.length,
  cold: { windingMs: +coldWinding.toFixed(3), rayMs: +coldRay.toFixed(3) },
  winding: { ...ws, min: +ws.min.toFixed(3), median: +ws.median.toFixed(3), p95: +ws.p95.toFixed(3), stddev: +ws.stddev.toFixed(3) },
  rayParity: { ...rs, min: +rs.min.toFixed(3), median: +rs.median.toFixed(3), p95: +rs.p95.toFixed(3), stddev: +rs.stddev.toFixed(3) },
  note: 'median ratio winding/ray = ' + ratio + ' measured at width/3 mesh; numbers may shift on other hosts',
};
console.log(JSON.stringify(out, null, 1));
writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');