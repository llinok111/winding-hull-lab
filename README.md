# winding-hull-lab

**One line:** On a triangle mesh with an open hole, the solid-angle generalized winding number classifies inside/outside at **100% accuracy across 12 hole sizes**, while a single-ray parity test degrades to **76.3%** and flips verdicts for **57.7% of points** when the ray direction is reversed (baseline: in-repo `rayParity`/`rayTriangle` in `src/core.mjs`, run by `bench/verify.mjs`).

Upstream: none

## How to run

```bash
node tools/gen-sample.mjs   # deterministic scene + reference data (fixed seed)
node bench/verify.mjs       # 12 assertions, exits 0
node bench/bench.mjs        # timing -> bench/result.json
python3 -m http.server 4173 # open localhost:4173, drag the hole slider
```

## What this is

A drop-in inside/outside classifier for **non-watertight** triangle meshes (holes, open boundaries, missing faces — the everyday reality of scanned/decimated models). Instead of casting one ray and hoping it doesn't graze an edge, it sums the per-triangle solid angle (the classic *generalized winding number*), normalized by 4π; `|w| > 0.5` means inside. The whole decision rule is `src/core.mjs` — pure ES module, no three.js, no DOM — so the browser slider and the node assertions run the **same** code.

## Evidence (measured on 2026-11-20, `bench/result.json`)

| metric | winding | single-ray parity |
|---|---|---|
| 12 hole fractions (8→98 tris removed), 480 pts each | **480/480 correct (100%)** | 95.8% → 76.3% as hole grows |
| direction reversibility (widest hole) | 0 flips (A6b: 0/480 under FP summation-order reversal) | **277/480 points (57.7%) flip inside↔outside** |
| closed-mesh control (no hole) | max |w|−1 deviation **3.8e-15** | — |
| per 480-query cost (10 samples) | median 45.8 ms, RSD 3.9% | median 28.8 ms, RSD 6.4% |

- Section A8: the classification *margin* (min |w| of true-inside points minus max |w| of true-outside points) shrinks monotonically from 0.329 → 0.085 as the hole grows, but never crosses zero — that measured margin is why winding reports 0 misclassifications, not a claim about arbitrary meshes.
- Scale invariance (A7): with mesh **and** query points scaled together by 1e-6, 1e-3, 1, 1e3, 1e6, both methods produce **identical** accuracy numbers (0.76/1.0). The ray baseline uses a scale-relative epsilon (det vs |e1||e2|·1e-12) so it doesn't silently break at extreme scales.

## Known limitations (disclosed thresholds)

- The `INSIDE` threshold is an absolute constant **0.5** on normalized winding. It is valid at the unit scale of this corpus (box edge = 1, queries 0.28–0.72 from center). A mesh scaled by ≤1e-6 or ≥1e6 relative to the query scale keeps the same |w| (we verified it), but a mesh whose features are within ~0.1 of the test box's wall approaches the margin; points within 0.05 of the boundary (inside the slab we excluded) are unsupported.
- The corpus is a single unit box with one quadrangular hole; `wAcc=1.0` is a property of these 12 scenes, not a universal guarantee for arbitrary open meshes. The *margins* (A8) generalize the intuition: solid-angle sums stay closer to 0.5 as the opening widens.
- Per-query cost is ~1.6× a single ray trace measured here (768 tris). No BVH/octree acceleration is included; that is the honest trade-off for direction-independence, not a speed claim.
- Winding is a global sum: it does not localize *where* the hole is. Parity and winding only answer inside/outside.