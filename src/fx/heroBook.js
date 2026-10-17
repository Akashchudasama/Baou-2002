// Home hero: a 3D open book whose pages turn on their own, lit by the real
// time of day in Ahmedabad (dawn, daylight, evening light, lamplight) — the
// "fourth dimension". Everything is procedural: no models or images are
// downloaded, so it costs nothing beyond the shared Three.js chunk.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';

const PAGE_W = 1.5;
const PAGE_H = 2.06;
const COLS = 28;

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Theme token → THREE.Color. Handles "r g b" triplets and hex values. */
function color(name) {
  const v = token(name);
  const c = new Color();
  if (/^\d+\s+\d+\s+\d+$/.test(v)) {
    const [r, g, b] = v.split(/\s+/).map(Number);
    return c.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  }
  try {
    return c.set(v || '#ffffff');
  } catch {
    return c.set('#ffffff');
  }
}

function pageTexture(seed) {
  const cv = document.createElement('canvas');
  cv.width = 384;
  cv.height = 528;
  const g = cv.getContext('2d');
  g.fillStyle = token('--paper-hi') || '#fffdf8';
  g.fillRect(0, 0, cv.width, cv.height);
  // soft gutter shadow
  const grd = g.createLinearGradient(0, 0, 60, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 60, cv.height);
  const [r, gg, b] = (token('--accent-rgb') || '58 8 16').split(/\s+/).map(Number);
  const ink = (a) => `rgba(${r},${gg},${b},${a})`;
  // ornamental heading and drop cap
  g.fillStyle = ink(0.85);
  g.fillRect(118, 52, 150, 6);
  g.fillRect(52, 92, 34, 40);
  g.strokeStyle = ink(0.35);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(52, 74);
  g.lineTo(332, 74);
  g.stroke();
  // text lines with a little pseudo-random rag
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 30; i++) {
    const y = 98 + i * 13.5;
    const x0 = i < 3 ? 96 : 52;
    const w = (332 - x0) * (i % 7 === 6 ? 0.45 + rand() * 0.2 : 0.9 + rand() * 0.1);
    g.fillStyle = ink(0.22 + rand() * 0.08);
    g.fillRect(x0, y, w, 3.2);
  }
  g.fillStyle = ink(0.4);
  g.fillRect(180, 500, 24, 2);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Bends a page plane around the spine: angle θ plus a curl toward the fore-edge. */
function bend(geo, theta, curl, lift) {
  const pos = geo.attributes.position;
  const dx = PAGE_W / COLS;
  const xs = new Float32Array(COLS + 1);
  const ys = new Float32Array(COLS + 1);
  let x = 0;
  let y = lift;
  let total = 0;
  for (let i = 0; i <= COLS; i++) {
    xs[i] = x;
    ys[i] = y;
    const f = i / COLS;
    const phi = theta + curl * f * f;
    x += Math.cos(phi) * dx;
    y += Math.sin(phi) * dx;
    total = phi;
  }
  for (let v = 0; v < pos.count; v++) {
    const col = v % (COLS + 1);
    pos.setX(v, xs[col]);
    pos.setY(v, ys[col]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return total;
}

const LIGHTING = {
  dawn: { sky: '#ffd9c2', ground: '#7a5a48', hemi: 0.75, sun: '#ffb38a', sunI: 1.6, lamp: 0.0, elev: 0.25, az: -1.0 },
  day: { sky: '#fffaf0', ground: '#8a7a60', hemi: 1.05, sun: '#fff6e0', sunI: 2.1, lamp: 0.0, elev: 1.0, az: 0.2 },
  dusk: { sky: '#ffd9a8', ground: '#6a4632', hemi: 0.85, sun: '#ffa65c', sunI: 1.8, lamp: 1.2, elev: 0.22, az: 1.1 },
  night: { sky: '#e6dccf', ground: '#4a3830', hemi: 0.72, sun: '#c9d3f2', sunI: 0.3, lamp: 5.5, elev: 0.6, az: 0.6 },
};

export function startHeroBook(host, { daylight } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 3.55, 4.6);
  camera.lookAt(0, 0, 0);

  const book = new Group();
  book.rotation.y = -0.18;
  scene.add(book);

  // --- materials (re-coloured on theme change)
  const coverMat = new MeshStandardMaterial({ roughness: 0.62, metalness: 0.08 });
  const edgeMat = new MeshStandardMaterial({ roughness: 0.9 });
  const ribbonMat = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.55, side: DoubleSide });
  const pageMats = [0, 1, 2].map(() => new MeshStandardMaterial({ roughness: 0.92, side: DoubleSide }));

  // --- covers and page blocks (slight V of an open book)
  const tilt = 0.09;
  for (const side of [-1, 1]) {
    const cover = new Mesh(new BoxGeometry(PAGE_W + 0.1, 0.05, PAGE_H + 0.12), coverMat);
    cover.position.set(side * (PAGE_W + 0.1) / 2, -0.07, 0);
    cover.rotation.z = side * tilt;
    book.add(cover);
    const block = new Mesh(new BoxGeometry(PAGE_W, 0.1, PAGE_H), edgeMat);
    block.position.set(side * PAGE_W / 2, 0.0, 0);
    block.rotation.z = side * tilt;
    book.add(block);
  }
  // resting top pages (left and right)
  const restGeo = () => new PlaneGeometry(PAGE_W, PAGE_H, COLS, 1).rotateX(-Math.PI / 2).translate(PAGE_W / 2, 0, 0);
  const left = new Mesh(restGeo(), pageMats[0]);
  const right = new Mesh(restGeo(), pageMats[1]);
  bend(left.geometry, Math.PI - tilt, 0, 0.055);
  bend(right.geometry, tilt, 0, 0.055);
  book.add(left, right);
  // the turning page
  const turning = new Mesh(restGeo(), pageMats[2]);
  book.add(turning);

  // ribbon bookmark
  const ribbon = new Mesh(new PlaneGeometry(0.06, 0.42), ribbonMat);
  ribbon.position.set(0.02, -0.1, PAGE_H / 2 + 0.16);
  ribbon.rotation.x = -1.35;
  book.add(ribbon);

  // contact shadow
  const shCanvas = document.createElement('canvas');
  shCanvas.width = shCanvas.height = 128;
  const sg = shCanvas.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(0,0,0,0.45)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = rg;
  sg.fillRect(0, 0, 128, 128);
  const shadow = new Mesh(new PlaneGeometry(4.4, 3.2), new MeshBasicMaterial({ map: new CanvasTexture(shCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.13;
  book.add(shadow);

  // gold motes drifting up from the pages
  const MOTES = 70;
  const mp = new Float32Array(MOTES * 3);
  const mv = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    mp[i * 3] = (Math.random() - 0.5) * 3.4;
    mp[i * 3 + 1] = Math.random() * 1.8;
    mp[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    mv[i] = 0.12 + Math.random() * 0.25;
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute('position', new BufferAttribute(mp, 3));
  const moteMat = new PointsMaterial({ size: 0.045, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending });
  const motes = new Points(moteGeo, moteMat);
  book.add(motes);

  // --- lights
  const hemi = new HemisphereLight('#ffffff', '#666666', 1);
  const sun = new DirectionalLight('#ffffff', 2);
  const lamp = new PointLight('#ffcf7a', 0, 8, 1.6);
  lamp.position.set(1.6, 1.6, 1.0);
  scene.add(hemi, sun, lamp);

  let textures = [];
  function applyTheme() {
    coverMat.color.copy(color('--accent-rgb'));
    edgeMat.color.copy(color('--paper-lo'));
    ribbonMat.color.copy(color('--brass-rgb'));
    moteMat.color.copy(color('--ink-glow'));
    textures.forEach((t) => t.dispose());
    textures = pageMats.map((m, i) => {
      const t = pageTexture(i + 3);
      m.map = t;
      m.needsUpdate = true;
      return t;
    });
  }

  function applyDaylight(d) {
    const L = LIGHTING[d?.phase] || LIGHTING.day;
    hemi.color.set(L.sky);
    hemi.groundColor.set(L.ground);
    hemi.intensity = L.hemi;
    sun.color.set(L.sun);
    sun.intensity = L.sunI;
    sun.position.set(Math.sin(L.az) * 4, 1 + L.elev * 4, Math.cos(L.az) * 3);
    lamp.intensity = L.lamp;
  }

  applyTheme();
  applyDaylight(daylight);

  // --- sizing
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // --- interaction: gentle parallax toward the pointer
  let tx = 0;
  let ty = 0;
  const onPointer = (e) => {
    const r = host.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // --- loop (≈30 fps, paused when hidden or scrolled away)
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) wake();
  });
  io.observe(host);

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let t = 0;
  const CYCLE = 5.2;
  const TURN = 1.7;

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    raf = requestAnimationFrame(frame);
    if (acc < 1 / 32) return;
    const step = acc;
    acc = 0;
    t += step;

    const c = t % CYCLE;
    const p = c < TURN ? c / TURN : 1;
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const theta = tilt + (Math.PI - 2 * tilt) * e;
    bend(turning.geometry, theta, 1.1 * Math.sin(Math.PI * e), 0.06 + 0.04 * Math.sin(Math.PI * e));
    turning.visible = c < TURN + 0.02;

    book.rotation.y += (-0.18 + tx - book.rotation.y) * 0.05;
    book.rotation.x += (ty - book.rotation.x) * 0.05;
    book.position.y = Math.sin(t * 0.9) * 0.035;
    ribbon.rotation.z = Math.sin(t * 1.3) * 0.08;

    for (let i = 0; i < MOTES; i++) {
      mp[i * 3 + 1] += mv[i] * step;
      mp[i * 3] += Math.sin(t + i) * 0.002;
      if (mp[i * 3 + 1] > 1.9) mp[i * 3 + 1] = 0.05;
    }
    moteGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    // reveal the 3D book only once a frame has really been drawn
    if (!host.classList.contains('has-3d')) host.classList.add('has-3d');
  }
  function wake() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  const onVis = () => !document.hidden && wake();
  document.addEventListener('visibilitychange', onVis);
  const onTheme = () => applyTheme();
  window.addEventListener('themechange', onTheme);
  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    destroy();
  });

  wake();

  function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('themechange', onTheme);
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); });
    });
    renderer.dispose();
    host.classList.remove('has-3d');
    canvas.remove();
  }

  return { destroy, setDaylight: applyDaylight };
}
