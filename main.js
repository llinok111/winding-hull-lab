// Front end only: builds three.js scene from deterministic data, consumes
// core's outputs (evaluateScene) for the live numbers. No core numbers are
// re-derived here.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { boxMesh, holeMask, queryPoints, evaluateScene, INSIDE } from './src/core.mjs';

const viewport = document.getElementById('viewport');
const cv = document.getElementById('cv');
const info = {
  wAcc: document.getElementById('wAcc'),
  rAcc: document.getElementById('rAcc'),
  dirDep: document.getElementById('dirDep'),
};
const fracInput = document.getElementById('frac');

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1017);
const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.01, 100);
camera.position.set(2.2, 1.8, 2.6);
const controls = new OrbitControls(camera, cv);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223044, 1.0));
scene.add(new THREE.DirectionalLight(0xffffff, 0.9).position.set(3, 4, 2));

// Grid helper
const grid = new THREE.GridHelper(2, 10, 0x33405a, 0x1c2434);
grid.position.y = -0.51;
scene.add(grid);

// Static box mesh (wireframe) from core
const base = boxMesh(8, 1);
const geoGeo = new THREE.BufferGeometry();
geoGeo.setAttribute('position', new THREE.Float32BufferAttribute(base.positions.flat(), 3));
geoGeo.setIndex(base.indices.flat());
const boxLines = new THREE.LineSegments(
  new THREE.EdgesGeometry(geoGeo),
  new THREE.LineBasicMaterial({ color: 0x4a5b7d })
);
scene.add(boxLines);

// Query points — recompute correctness live with core
const pts = queryPoints(12345, 240);
const pointGeo = new THREE.BufferGeometry();
pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
const pointMat = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, sizeAttenuation: true });
const cloud = new THREE.Points(pointGeo, pointMat);
scene.add(cloud);

function refresh() {
  const frac = parseFloat(fracInput.value);
  const mask = holeMask(base, frac);
  const mesh = { ...base, mask };
  const r = evaluateScene(mesh, pts);

  // color: green if |w|>0.5 (core's own rule), red otherwise
  const colors = new Float32Array(pts.length * 3);
  const truth = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = Math.abs(p[0]) < 0.5 && Math.abs(p[1]) < 0.5 && Math.abs(p[2]) < 0.5;
    truth[i] = t ? 1 : 0;
    const w = r.rows[i].w;
    const inside = Math.abs(w) > INSIDE;
    colors[i * 3] = inside ? 0.13 : 0.85;
    colors[i * 3 + 1] = inside ? 0.84 : 0.18;
    colors[i * 3 + 2] = inside ? 0.22 : 0.18;
  }
  pointGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  info.wAcc.textContent = (r.wCorrect / r.total).toFixed(4);
  info.rAcc.textContent = (r.rCorrect / r.total).toFixed(4);
  info.dirDep.textContent = `${r.disagree}/${r.total}`;
}
fracInput.addEventListener('input', refresh);
refresh();

function onResize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}
loop();