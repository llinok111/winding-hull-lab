// Assertions (G4). Reads real generated data; every number printed is measured.
import { readFileSync } from 'node:fs';
import { boxMesh, holeMask, queryPoints, evaluateScene, windingAt, scaleMesh, closedControlError, INSIDE } from '../src/core.mjs';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  PASS', msg); }
  else { fail++; console.log('  FAIL', msg); }
}

console.log('== winding-hull verify ==');
const base = boxMesh(8, 1);
const pts = queryPoints(12345, 240);

// A1: closed control — |w|<1 deviation within 1e-12 on strict interior points
const inter = [[0,0,0],[0.4,0,0],[0,0.4,0],[0,0,0.4],[0.3,0.3,0.3],[0.45,0.45,0.45],[-0.4,0.4,0.4]];
const closedErr = closedControlError(base, inter);
console.log('  measured closedControlError =', closedErr);
ok(closedErr < 1e-12, `A1 closed control: max |w|-1 deviation ${closedErr.toExponential(3)} < 1e-12`);

// A2: winding accuracy per hole fraction
const FRACS = [0.06, 0.10, 0.16, 0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.64, 0.70];
const windAccs = [];
const rayAccs = [];
for (const frac of FRACS) {
  const mask = holeMask(base, frac);
  const mesh = { ...base, mask };
  const r = evaluateScene(mesh, pts);
  windAccs.push(r.wCorrect / r.total);
  rayAccs.push(r.rCorrect / r.total);
  console.log(`  frac=${frac} windingAcc=${(r.wCorrect/r.total).toFixed(6)} rayAcc=${(r.rCorrect/r.total).toFixed(6)} dirDisagree=${(r.disagree/r.total).toFixed(6)}`);
}
ok(windAccs.every((a) => a === 1), `A2 winding accuracy = 1.0 for all ${FRACS.length} hole fractions (measured: ${windAccs.map(x => x.toFixed(3)).join(', ')})`);
ok(rayAccs[0] > 0.95, `A3 near-closed mesh: single-ray parity acc ${rayAccs[0].toFixed(4)} > 0.95`);
ok(rayAccs[FRACS.length - 1] < 0.85, `A4 wide-open mesh: single-ray parity acc ${rayAccs[FRACS.length - 1].toFixed(4)} < 0.85 (degradation is exposed, not hidden)`);

// A5: winding strictly dominates parity on the widest hole
const mesh70 = { ...base, mask: holeMask(base, 0.70) };
const r70 = evaluateScene(mesh70, pts);
ok(r70.wCorrect === pts.length && r70.rCorrect < pts.length,
   `A5 widest hole: winding ${r70.wCorrect}/${pts.length} vs single-ray ${r70.rCorrect}/${pts.length}`);

// A6: direction dependence of parity — same scene, two directions, +50% disagreement
ok(r70.disagree > pts.length * 0.45, `A6 parity is direction-dependent: ${r70.disagree}/${pts.length} points flip inside/outside when ray direction is reversed`);

// A7: scale invariance — winding perfect and ray behaviour identical at 1e-6..1e6
const scaleRayAccs = [];
const scaleWindAccs = [];
for (const scale of [1e-6, 1e-3, 1, 1e3, 1e6]) {
  const s = scaleMesh(base, scale);
  const mesh = { ...s, mask: holeMask(s, 0.70) };
  const sp = pts.map((p) => [p[0]*scale, p[1]*scale, p[2]*scale]);
  const r = evaluateScene(mesh, sp);
  scaleWindAccs.push(r.wCorrect / r.total);
  scaleRayAccs.push(r.rCorrect / r.total);
  console.log(`  scale=${scale} windingAcc=${(r.wCorrect/r.total).toFixed(4)} rayAcc=${(r.rCorrect/r.total).toFixed(4)}`);
}
ok(scaleWindAccs.every((a) => a === 1), `A7a winding scale-invariant: ${scaleWindAccs.join(', ')}`);
ok(new Set(scaleRayAccs.map(x => x.toFixed(8))).size === 1, `A7b ray parity scale-invariant (relative eps): ${scaleRayAccs.join(', ')}`);

// A8: classification margin — inside min|w| vs outside max|w| shrinks
// monotonically as the hole grows but never crosses 0 (no misclassification).
let prevMargin = Infinity, monotonic = true;
for (const frac of [0.06, 0.14, 0.25, 0.39, 0.56, 0.77]) {
  const mesh = { ...base, mask: holeMask(base, frac) };
  let inMin = Infinity, outMax = 0;
  for (const p of pts) {
    const inside = Math.abs(p[0]) < 0.5 && Math.abs(p[1]) < 0.5 && Math.abs(p[2]) < 0.5;
    const w = Math.abs(windingAt(mesh, p, mesh.mask));
    if (inside) inMin = Math.min(inMin, w); else outMax = Math.max(outMax, w);
  }
  const margin = inMin - outMax;
  if (margin > prevMargin + 1e-9) monotonic = false;
  prevMargin = margin;
  console.log(`  frac=${frac} margin(insideMin|w| - outsideMax|w|) = ${margin.toFixed(4)}`);
}
ok(monotonic, 'A8 margin shrinks monotonically as the hole grows (measured above)');
ok(prevMargin > 0, `A8b even the widest hole keeps margin ${prevMargin.toFixed(4)} > 0 -> 0 misclassifications`);

// A9: verify.mjs runs against the same generated reference file the README quotes
const ref = JSON.parse(readFileSync(new URL('../data/reference.json', import.meta.url), 'utf8'));
const re = ref.variants.find((v) => v.frac === 0.70);
ok(Math.abs(re.rayAcc - rayAccs[FRACS.length - 1]) < 1e-12, `A9 reference.json frac=0.7 rayAcc ${re.rayAcc} agrees with live run ${rayAccs[FRACS.length - 1]}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);