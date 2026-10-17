// 3D book-spine page turn with curl and light.
//
// The outgoing (or incoming) page is cloned into a chain of nested vertical
// strips. Each strip is hinged to the previous one, so small per-strip
// rotations add up to a smooth paper curl. A damped spring drives the turn,
// and every strip is shaded from its true angle to the light, with a
// specular sheen on the tightest part of the curl and a soft shadow cast on
// the page beneath.

const SPRING_K = 70; // stiffness: how hard the paper springs toward rest
const DAMPING = 0.92; // just under critical: a soft, natural settle

function stripCount(width) {
  return width < 560 ? 8 : width < 900 ? 11 : 14;
}

function sanitiseClone(node) {
  const clone = node.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  clone.querySelectorAll('iframe, video, audio, canvas, dialog').forEach((n) => n.remove());
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  return clone;
}

function buildLeaf(sourceEl, width, height, offsetY) {
  const n = stripCount(width);
  const w = width / n;
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.style.width = `${width}px`;
  leaf.style.height = `${height}px`;

  const strips = [];
  let parent = leaf;
  for (let i = 0; i < n; i++) {
    const strip = document.createElement('div');
    strip.className = 'leaf-strip';
    strip.style.width = `${w + 0.6}px`; // tiny overlap hides seams
    strip.style.left = i === 0 ? '0px' : `${w}px`;

    const front = document.createElement('div');
    front.className = 'leaf-face leaf-front';
    const clone = sanitiseClone(sourceEl);
    clone.classList.add('leaf-clone');
    clone.style.width = `${width}px`;
    clone.style.transform = `translate(${-i * w}px, ${-offsetY}px)`;
    front.append(clone);
    const frontShade = document.createElement('div');
    frontShade.className = 'leaf-shade';
    front.append(frontShade);

    const back = document.createElement('div');
    back.className = 'leaf-face leaf-back';
    back.style.backgroundPosition = `${-i * w}px 0`;
    const backShade = document.createElement('div');
    backShade.className = 'leaf-shade';
    back.append(backShade);

    strip.append(front, back);
    parent.append(strip);
    strips.push({ el: strip, frontShade, backShade });
    parent = strip;
  }
  // curl weights grow toward the free edge (the fore-edge leads the turn)
  const raw = strips.map((_, i) => (i === 0 ? 0 : Math.pow(i / (n - 1), 1.6)));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const weights = raw.map((r) => r / sum);
  return { leaf, strips, weights };
}

function pose(state, p) {
  const { strips, weights, castShadow, leaf } = state;
  const q = Math.min(1, Math.max(0, p));
  const spine = -180 * q;
  const curl = 105 * Math.sin(Math.PI * q);
  // the leaf settles into the spine instead of lying over the navigation
  leaf.style.opacity = q < 0.72 ? '1' : String(Math.max(0, 1 - (q - 0.72) / 0.28));
  let total = 0;
  strips.forEach((s, i) => {
    const local = i === 0 ? spine : -curl * weights[i];
    total += local;
    s.el.style.transform = `rotateY(${local.toFixed(3)}deg)`;
    const cos = Math.cos((total * Math.PI) / 180);
    const facing = Math.abs(cos);
    const sheen = Math.min(0.32, (Math.abs(local) / 14) * 0.32) * (i === 0 ? 0 : 1);
    const dark = (1 - facing) * 0.55;
    s.frontShade.style.setProperty('--dark', dark.toFixed(3));
    s.frontShade.style.setProperty('--sheen', sheen.toFixed(3));
    s.backShade.style.setProperty('--dark', (dark * 0.8 + 0.06).toFixed(3));
    s.backShade.style.setProperty('--sheen', (sheen * 0.6).toFixed(3));
  });
  castShadow.style.setProperty('--lift', Math.sin(Math.PI * q).toFixed(3));
  castShadow.style.setProperty('--edge', `${(50 + 50 * Math.cos(Math.PI * q)).toFixed(2)}%`);
}

/**
 * Creates the page-turn controller for a stage element.
 * turn({ direction, pageEl, render }) returns a Promise that resolves when done.
 *   - direction: 'forward' | 'back'
 *   - pageEl: the live page element (content is swapped by `render`)
 *   - render(): synchronously replaces pageEl's content with the new section
 */
export function createPageTurner(stage) {
  let active = null;

  function finishNow() {
    if (active) active.finish();
  }

  function turn({ direction, pageEl, render }) {
    finishNow();
    return new Promise((resolve) => {
      const stageRect = stage.getBoundingClientRect();
      const offsetY = Math.max(0, -stageRect.top);
      const width = stage.clientWidth;
      const visible = Math.min(pageEl.scrollHeight - offsetY, window.innerHeight - Math.max(0, stageRect.top));
      const height = Math.max(240, Math.min(visible, window.innerHeight));

      const oldCopy = sanitiseClone(pageEl);
      render();
      const forward = direction === 'forward';
      // forward: the old page lifts away, revealing the new page beneath.
      // back: the new page swings back over a frozen copy of the old one.
      const leafSource = forward ? oldCopy : sanitiseClone(pageEl);
      const built = buildLeaf(leafSource, width, height, forward ? offsetY : 0);
      const castShadow = document.createElement('div');
      castShadow.className = 'leaf-cast';
      castShadow.style.height = `${height}px`;

      let underlay = null;
      if (!forward) {
        underlay = document.createElement('div');
        underlay.className = 'leaf-underlay';
        underlay.style.height = `${height}px`;
        oldCopy.classList.add('leaf-clone');
        oldCopy.style.width = `${width}px`;
        oldCopy.style.transform = `translateY(${-offsetY}px)`;
        underlay.append(oldCopy);
      }

      const layer = document.createElement('div');
      layer.className = 'leaf-layer';
      layer.setAttribute('aria-hidden', 'true');
      if (underlay) layer.append(underlay);
      layer.append(castShadow, built.leaf);
      if (offsetY > 0) window.scrollTo({ top: window.scrollY + stageRect.top - 8, behavior: 'instant' });
      stage.append(layer);
      stage.classList.add('is-turning');

      const state = { ...built, castShadow };
      let p = forward ? 0 : 1;
      const target = forward ? 1 : 0;
      let v = forward ? 0.9 : -0.9; // the reader's flick
      const c = 2 * DAMPING * Math.sqrt(SPRING_K);
      let last = performance.now();
      let raf = 0;

      const done = () => {
        cancelAnimationFrame(raf);
        layer.remove();
        stage.classList.remove('is-turning');
        active = null;
        resolve();
      };

      const tick = (now) => {
        // fixed-step integration keeps the turn's real duration identical on slow devices
        let dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        while (dt > 0) {
          const h = Math.min(dt, 1 / 240);
          v += (SPRING_K * (target - p) - c * v) * h;
          p += v * h;
          dt -= h;
        }
        pose(state, p);
        if (Math.abs(target - p) < 0.003 && Math.abs(v) < 0.03) return done();
        raf = requestAnimationFrame(tick);
      };

      pose(state, p);
      raf = requestAnimationFrame(tick);
      active = { finish: done };
    });
  }

  return { turn, finishNow };
}
