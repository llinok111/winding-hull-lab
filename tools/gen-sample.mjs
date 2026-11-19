// Deterministic scene generator. Writes data/scenes.json and data/reference.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { boxMesh, holeMask, queryPoints, evaluateScene } from '../src/core.mjs';

const N = 8;
const FRACS = [0.06, 0.10, 0.16, 0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.64, 0.70];
const base = boxMesh(N, 1);
const pts = queryPoints(12345, 240);

const variants = FRACS.map((frac, i) => {
  const mask = holeMask(base, frac);
  return { id: i, frac, removedTris: mask.reduce((a, v) => a + (v ? 0 : 1), 0) };
});

const scenes = {
  n: N,
  size: 1,
  points: pts.map((p) => p.map((v) => +v.toFixed(6))),
  variants,
};
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/scenes.json', import.meta.url), JSON.stringify(scenes) + '\n');

// Reference run: accuracy of both methods, per variant, from the same core.
const ref = { variants: [], totalPoints: pts.length };
for (const v of variants) {
  const mesh = { ...base, mask: holeMask(base, v.frac) };
  const r = evaluateScene(mesh, pts);
  ref.variants.push({
    id: v.id,
    frac: v.frac,
    removedTris: v.removedTris,
    windingAcc: r.wCorrect / r.total,
    rayAcc: r.rCorrect / r.total,
    dirDisagree: r.disagree / r.total,
  });
}
writeFileSync(new URL('../data/reference.json', import.meta.url), JSON.stringify(ref, null, 2) + '\n');
console.log(`wrote data/scenes.json (${variants.length} variants, ${pts.length} points) and data/reference.json`);
