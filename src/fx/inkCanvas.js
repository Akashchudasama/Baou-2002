// WebGL "golden fountain pen": the cursor bleeds antique-brass ink that
// diffuses into the parchment through a gentle flow field, then dries away.
// Loaded lazily (code-split) and only on capable devices.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aTint;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vAlpha = aAlpha;
    vTint = aTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uInk;
  uniform vec3 uGlow;
  uniform float uTime;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.55, 0.0, d);
    float halo = smoothstep(1.0, 0.15, d);
    float shimmer = 0.92 + 0.08 * sin(uTime * 3.0 + vTint * 40.0);
    vec3 col = mix(uGlow, uInk, clamp(core * 0.9 + vTint * 0.2, 0.0, 1.0)) * shimmer;
    float a = (halo * 0.5 + core * 0.5) * vAlpha;
    gl_FragColor = vec4(col * a, a); // premultiplied
  }
`;

function themeToken(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

export function startInk(canvas, { max = 2600 } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  const pr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pr);

  const scene = new Scene();
  let W = window.innerWidth;
  let H = window.innerHeight;
  const camera = new OrthographicCamera(0, W, 0, H, -1, 1);

  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  const tint = new Float32Array(max);
  const vx = new Float32Array(max);
  const vy = new Float32Array(max);
  const age = new Float32Array(max);
  const life = new Float32Array(max).fill(0);
  const base = new Float32Array(max);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
  geo.setAttribute('aTint', new BufferAttribute(tint, 1));

  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    premultipliedAlpha: true,
    uniforms: {
      uInk: { value: new Color(themeToken('--ink-core', '#B8913F')) },
      uGlow: { value: new Color(themeToken('--ink-glow', '#F7E7B4')) },
      uPixelRatio: { value: pr },
      uTime: { value: 0 },
    },
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let live = 0;
  let raf = 0;
  let last = performance.now();
  let lastX = null;
  let lastY = null;
  let t = 0;

  function emit(x, y, dx, dy) {
    const i = cursor;
    cursor = (cursor + 1) % max;
    if (life[i] <= 0) live++;
    pos[i * 3] = x + (Math.random() - 0.5) * 3;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * 3;
    const a = Math.random() * Math.PI * 2;
    const sp = 0.15 + Math.random() * 0.55;
    vx[i] = dx * 0.035 + Math.cos(a) * sp;
    vy[i] = dy * 0.035 + Math.sin(a) * sp;
    age[i] = 0;
    life[i] = 1.4 + Math.random() * 2.0;
    base[i] = 7 + Math.random() * 16;
    tint[i] = Math.random();
  }

  function onMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (lastX === null) {
      lastX = x;
      lastY = y;
      return;
    }
    const dx = x - lastX;
    const dy = y - lastY;
    const dist = Math.hypot(dx, dy);
    const n = Math.min(16, Math.ceil(dist / 5)) + 1;
    for (let k = 0; k < n; k++) {
      const f = k / n;
      emit(lastX + dx * f, lastY + dy * f, dx, dy);
    }
    lastX = x;
    lastY = y;
    wake();
  }

  function onLeave() {
    lastX = lastY = null;
  }

  function step(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    t += dt;
    mat.uniforms.uTime.value = t;
    const f = dt * 60;
    let alive = 0;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) {
        alpha[i] = 0;
        continue;
      }
      age[i] += dt;
      const p = age[i] / life[i];
      if (p >= 1) {
        life[i] = 0;
        alpha[i] = 0;
        continue;
      }
      alive++;
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      // Smooth pseudo-curl flow field: ink wicks along the paper's fibres.
      const ang = Math.sin(x * 0.0042 + t * 0.35) * Math.cos(y * 0.0051 - t * 0.27) * Math.PI * 2;
      vx[i] = (vx[i] + Math.cos(ang) * 0.014 * f) * Math.pow(0.962, f);
      vy[i] = (vy[i] + Math.sin(ang) * 0.014 * f + 0.002 * f) * Math.pow(0.962, f);
      pos[i * 3] = x + vx[i] * f;
      pos[i * 3 + 1] = y + vy[i] * f;
      size[i] = base[i] * (1 + p * 1.6); // bleeding outwards as it soaks in
      const fadeIn = Math.min(1, age[i] / 0.08);
      alpha[i] = fadeIn * Math.pow(1 - p, 1.7) * 0.82;
    }
    live = alive;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aTint.needsUpdate = true;
    renderer.render(scene, camera);
    raf = live > 0 && !document.hidden ? requestAnimationFrame(step) : 0;
    if (!raf) renderer.render(scene, camera);
  }

  function wake() {
    if (!raf && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.right = W;
    camera.bottom = H;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function onVisibility() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && live > 0) wake();
  }

  function onTheme() {
    mat.uniforms.uInk.value.set(themeToken('--ink-core', '#B8913F'));
    mat.uniforms.uGlow.value.set(themeToken('--ink-glow', '#F7E7B4'));
  }

  resize();
  window.addEventListener('themechange', onTheme);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    destroy();
  });

  function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('themechange', onTheme);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
    canvas.hidden = true;
  }

  return { destroy };
}
