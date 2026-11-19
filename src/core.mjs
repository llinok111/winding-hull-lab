// Pure geometry core: generalized winding number (solid-angle sum) for
// triangle meshes with holes, plus a single-ray parity baseline.
// No three.js, no DOM, no I/O. Deterministic.

export const FOUR_PI = 4 * Math.PI;
export const INSIDE = 0.5; // |w| > 0.5 means inside

// Signed solid angle of triangle (a,b,c) seen from origin.
// Vectors are [x,y,z] already relative to the query point.
export function solidAngle(a, b, c) {
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  const lc = Math.hypot(c[0], c[1], c[2]);
  const det =
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
  const den =
    la * lb * lc +
    (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * lc +
    (a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) * lb +
    (b[0] * c[0] + b[1] * c[1] + b[2] * c[2]) * la;
  return 2 * Math.atan2(det, den);
}

// mesh = { positions: [[x,y,z],...], indices: [[i,j,k],...] }
export function windingAt(mesh, p, mask) {
  const { positions, indices } = mesh;
  let w = 0;
  for (let f = 0; f < indices.length; f++) {
    if (mask && mask[f] === 0) continue;
    const t = indices[f];
    const A = positions[t[0]], B = positions[t[1]], C = positions[t[2]];
    const a = [A[0] - p[0], A[1] - p[1], A[2] - p[2]];
    const b = [B[0] - p[0], B[1] - p[1], B[2] - p[2]];
    const c = [C[0] - p[0], C[1] - p[1], C[2] - p[2]];
    w += solidAngle(a, b, c);
  }
  return w / FOUR_PI;
}

// Moller-Trumbore, returns hit t or null. Used only by the baseline.
// eps is scale-relative: compared against |e1||e2| so the shear
// rejection threshold stays invariant under uniform scaling.
export function rayTriangle(o, d, A, B, C, eps = 1e-12) {
  const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const mag2 = Math.hypot(e1[0], e1[1], e1[2]) * Math.hypot(e2[0], e2[1], e2[2]);
  const epsS = mag2 * eps;
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(det) < epsS) return null;
  const inv = 1 / det;
  const s = [o[0] - A[0], o[1] - A[1], o[2] - A[2]];
  const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) * inv;
  if (u < 0 || u > 1) return null;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 1e-9 ? t : null;
}

// Single-direction ray parity. Direction is deliberately non-axis-aligned.
export const RAY_DIR = (() => {
  const v = [0.3127, 0.7193, 0.6180];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

export function rayParity(mesh, p, dir = RAY_DIR, mask) {
  const { positions, indices } = mesh;
  let hits = 0;
  for (let f = 0; f < indices.length; f++) {
    if (mask && mask[f] === 0) continue;
    const t = indices[f];
    const A = positions[t[0]], B = positions[t[1]], C = positions[t[2]];
    if (rayTriangle(p, dir, A, B, C) !== null) hits++;
  }
  return (hits & 1) === 1; // true = odd crossings = inside
}

// Axis-aligned box [-s/2, s/2]^3, each face an n x n quad grid.
// Faces are emitted in fixed order: +X, -X, +Y, -Y, +Z, -Z.
export function boxMesh(n = 8, s = 1) {
  const positions = [];
  const indices = [];
  const h = s / 2;
  const faceDefs = [
    { o: [h, -h, -h], u: [0, s / n, 0], v: [0, 0, s / n] },   // +X
    { o: [-h, -h, h], u: [0, s / n, 0], v: [0, 0, -s / n] },  // -X
    { o: [-h, h, -h], u: [0, 0, s / n], v: [s / n, 0, 0] },   // +Y
    { o: [-h, -h, h], u: [0, 0, -s / n], v: [s / n, 0, 0] },  // -Y
    { o: [-h, -h, h], u: [s / n, 0, 0], v: [0, s / n, 0] },   // +Z
    { o: [h, -h, -h], u: [-s / n, 0, 0], v: [0, s / n, 0] },  // -Z
  ];
  for (const f of faceDefs) {
    const base = positions.length;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        positions.push([
          f.o[0] + f.u[0] * i + f.v[0] * j,
          f.o[1] + f.u[1] * i + f.v[1] * j,
          f.o[2] + f.u[2] * i + f.v[2] * j,
        ]);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i;
        const b = a + 1, c = a + (n + 1), d = c + 1;
        indices.push([a, c, b], [b, c, d]);
      }
    }
  }
  return { positions, indices, n, size: s };
}

// Deterministic hole: remove a centered square patch of the +X face.
// frac in [0,1] is the fraction of +X quads removed; +X face owns the
// first (n*n*2) triangles in boxMesh order.
export function holeMask(mesh, frac) {
  const n = mesh.n;
  const quads = n * n;
  const want = Math.round(quads * frac);
  const side = Math.round(Math.sqrt(want));
  const lo = Math.floor((n - side) / 2);
  const hi = lo + side;
  const mask = new Uint8Array(mesh.indices.length).fill(1);
  for (let j = lo; j < hi; j++) {
    for (let i = lo; i < hi; i++) {
      const q = j * n + i;
      mask[2 * q] = 0;
      mask[2 * q + 1] = 0;
    }
  }
  return mask;
}

// Deterministic PRNG (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 480 query points in two slabs next to the +X face (where the hole is):
// inside slab x in [0.28,0.46], outside slab x in [0.54,0.72], y,z in [-0.3,0.3].
export function queryPoints(seed = 12345, perSide = 240) {
  const r = rng(seed);
  const pts = [];
  for (let k = 0; k < perSide; k++) {
    const x = 0.28 + 0.18 * r();
    const y = -0.3 + 0.6 * r();
    const z = -0.3 + 0.6 * r();
    pts.push([x, y, z]);
  }
  for (let k = 0; k < perSide; k++) {
    const x = 0.54 + 0.18 * r();
    const y = -0.3 + 0.6 * r();
    const z = -0.3 + 0.6 * r();
    pts.push([x, y, z]);
  }
  return pts;
}

export function scaleMesh(mesh, k) {
  return {
    positions: mesh.positions.map((p) => [p[0] * k, p[1] * k, p[2] * k]),
    indices: mesh.indices,
    n: mesh.n,
    size: mesh.size * k,
  };
}

// Evaluate one scene: winding accuracy vs analytic box truth, ray parity
// accuracy (same ray direction), and opposite-direction disagreement.
export function evaluateScene(mesh, pts) {
  const mask = mesh.mask;
  const invDir = RAY_DIR.map((x) => -x);
  let wCorrect = 0, rCorrect = 0, disagree = 0;
  let maxClosedErr = 0;
  const rows = [];
  for (const p of pts) {
    const w = windingAt(mesh, p, mask);
    const truth = Math.abs(p[0]) < mesh.size / 2 && Math.abs(p[1]) < mesh.size / 2 && Math.abs(p[2]) < mesh.size / 2;
    const wInside = Math.abs(w) > INSIDE;
    const rIn = rayParity(mesh, p, RAY_DIR, mask);
    const rOut = rayParity(mesh, p, invDir, mask);
    if (wInside === truth) wCorrect++;
    if (rIn === truth) rCorrect++;
    if (rIn !== rOut) disagree++;
    rows.push({ p, w, truth, wInside, rIn, rOut });
  }
  return { total: pts.length, wCorrect, rCorrect, disagree, rows };
}

// Closed-mesh control: |w| should be 1 for interior points.
export function closedControlError(mesh, pts) {
  let maxErr = 0;
  for (const p of pts) {
    const w = Math.abs(windingAt(mesh, p));
    maxErr = Math.max(maxErr, Math.abs(w - 1));
  }
  return maxErr;
}
