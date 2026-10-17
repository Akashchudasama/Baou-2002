// Portal entry: loads content, builds the book, routes between folios.

import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/inter';
import './styles/themes.css';
import './styles/base.css';
import './styles/portal.css';

import { DEMO_MODE } from './config.js';
import { linksFor, loadContent, setting } from './lib/content.js';
import { daylight, paintChip, startDaylight } from './lib/daylight.js';
import { detectTier, prefersReducedMotion, savedTier, saveTier } from './lib/device.js';
import { clear, h, safeUrl } from './lib/dom.js';
import { applyTheme } from './lib/themes.js';
import { createPageTurner } from './fx/pageTurn.js';
import { renderSection } from './components/sections.js';
import { mountInkwell } from './components/inkwell.js';
import { initialTheme, mountThemePicker } from './components/themePicker.js';
import { localized, t, getLang } from './lib/i18n.js';
import { mountReadingTools } from './components/readingTools.js';
import { tirangaRibbon } from './components/tiranga.js';

const root = document.documentElement;
const tier = detectTier();
root.dataset.fx = tier;
if (getLang() === 'gu') root.lang = 'gu';
const rich = tier === 'full';

const els = {
  brand: document.getElementById('brand'),
  ticker: document.getElementById('ticker'),
  net: document.getElementById('net-status'),
  spine: document.getElementById('spine'),
  stage: document.getElementById('stage'),
  page: document.getElementById('page'),
  footer: document.getElementById('footer'),
  canvas: document.getElementById('ink'),
};

let content = null;
let current = null;
let hero = null; // live 3D hero, when the Home folio is open
const turner = createPageTurner(els.stage);

// ---------- Shell ------------------------------------------------------------
function renderBrand() {
  clear(els.brand).append(
    h('a', { class: 'crest', href: '#/', 'aria-label': 'Home' },
      h('span', { class: 'crest-mark', 'aria-hidden': 'true' }, setting(content, 'university_short', '').slice(0, 4))),
    h('div', { class: 'brand-text' },
      h('p', { class: 'brand-univ' }, setting(content, 'university_name')),
      h('p', { class: 'brand-dept' }, setting(content, 'department_name')),
      h('p', { class: 'brand-school' }, [setting(content, 'school_name'), setting(content, 'city')].filter(Boolean).join(' · '))),
    h('div', { class: 'masthead-tools', id: 'masthead-tools' }));
  const tools = document.getElementById('masthead-tools');
  mountThemePicker(tools, content);
  mountReadingTools(tools, () => els.page);
  if (!document.querySelector('.tiranga')) els.brand.closest('.masthead').after(tirangaRibbon());
}

function renderTicker() {
  const items = content.announcements;
  if (!items.length) {
    els.ticker.hidden = true;
    return;
  }
  els.ticker.hidden = false;
  const track = h('div', { class: 'ticker-track' });
  const makeRun = (hidden) => h('ul', { class: 'ticker-run', 'aria-hidden': hidden ? 'true' : null },
    items.map((a) => {
      const url = safeUrl(a.link_url);
      return h('li', {}, url ? h('a', { href: url, target: '_blank', rel: 'noopener', tabindex: hidden ? '-1' : null }, a.title) : a.title);
    }));
  track.append(makeRun(false), makeRun(true));
  track.style.setProperty('--dur', `${Math.max(24, items.reduce((n, a) => n + a.title.length, 0) * 0.22)}s`);
  clear(els.ticker).append(h('span', { class: 'ticker-label' }, t('Notices')), h('div', { class: 'ticker-viewport' }, track));
}

function renderSpine() {
  clear(els.spine).append(h('ol', {}, content.sections.map((sec, i) =>
    h('li', {},
      h('a', { href: `#/${sec.slug}`, class: 'ribbon', dataset: { slug: sec.slug } },
        h('span', { class: 'ribbon-num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'ribbon-title' }, localized(sec, 'title')))))));
}

function experienceControl() {
  const chosen = savedTier() || 'auto';
  const options = [
    ['auto', t('Automatic')],
    ['full', t('Rich 3D')],
    ['lite', t('Light')],
    ['saver', t('Data saver')],
  ];
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t('Experience') },
    options.map(([v, label]) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === chosen), class: 'seg' }, label);
      b.addEventListener('click', () => {
        saveTier(v === 'auto' ? null : v);
        location.reload();
      });
      return b;
    }));
  const note = {
    full: 'Rich 3D: animated ink, 3D pages and hero.',
    lite: 'Light: smooth 2D pages, fewer effects.',
    saver: 'Data saver: system fonts, no auto-loading images or video previews; pages you open are kept for offline use.',
  }[tier];
  return h('div', { class: 'experience' }, h('span', { class: 'mini' }, t('Experience')), group, h('small', { class: 'muted' }, `Now: ${note}`));
}

function footerLinks() {
  const main = linksFor(content, 'footer');
  const social = linksFor(content, 'social');
  if (!main.length && !social.length) return null;
  const a = (l) => h('a', { href: safeUrl(l.url), target: '_blank', rel: 'noopener' }, l.label);
  return h('nav', { class: 'footer-links', 'aria-label': 'University links' },
    main.map(a),
    social.length ? h('span', { class: 'social' }, h('span', { class: 'mini' }, 'Follow'), social.map(a)) : null);
}

function renderFooter() {
  clear(els.footer).append(
    h('p', {}, setting(content, 'footer_note')),
    footerLinks(),
    h('p', { class: 'muted' }, `© ${new Date().getFullYear()} ${setting(content, 'university_name')}`),
    experienceControl(),
    h('div', { class: 'footer-tools' },
      h('span', { class: 'offline-ready', id: 'offline-ready', hidden: true }, t('Saved for offline reading')),
      DEMO_MODE ? h('span', { class: 'demo-badge' }, 'Demo data — connect Supabase to go live') : null));
}

// ---------- 3D hero (Home only, rich tier) ---------------------------------
function stopHero() {
  hero?.destroy();
  hero = null;
}

async function startHero() {
  const host = els.page.querySelector('.hero-visual');
  paintChip();
  if (!rich || !host || hero) return;
  try {
    const { startHeroBook } = await import('./fx/heroBook.js');
    if (host.isConnected && !hero) hero = startHeroBook(host, { daylight: daylight() });
  } catch (e) {
    console.warn('3D hero unavailable', e);
  }
}

// ---------- Routing ------------------------------------------------------------
function slugFromHash() {
  const slug = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')[0];
  return content.sections.find((sec) => sec.slug === slug) ? slug : content.sections[0]?.slug;
}

function paint(section) {
  stopHero();
  clear(els.page).append(...renderSection(section, content, {}).filter(Boolean));
  els.page.dataset.section = section.slug;
}

async function go(slug, { initial = false } = {}) {
  const section = content.sections.find((sec) => sec.slug === slug);
  if (!section) return;
  const fromIdx = content.sections.findIndex((sec) => sec.slug === current);
  const toIdx = content.sections.findIndex((sec) => sec.slug === slug);

  els.spine.querySelectorAll('.ribbon').forEach((a) => {
    if (a.dataset.slug === slug) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (initial || current === slug || prefersReducedMotion() || tier === 'saver') {
    paint(section);
  } else if (rich) {
    await turner.turn({ direction: toIdx >= fromIdx ? 'forward' : 'back', pageEl: els.page, render: () => paint(section) });
  } else {
    paint(section);
    els.page.classList.remove('page-enter', 'page-enter-back');
    void els.page.offsetWidth; // restart the 2D animation
    els.page.classList.add(toIdx >= fromIdx ? 'page-enter' : 'page-enter-back');
  }
  if (!initial) {
    const top = els.stage.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: rich ? 'smooth' : 'auto' });
  }

  current = slug;
  const base = `${setting(content, 'department_name')} · ${setting(content, 'university_short')}`;
  const isHome = section.renderer === 'home' || section.renderer === 'overview';
  document.title = isHome ? base : `${localized(section, 'title')} · ${base}`;
  if (!initial) document.getElementById('folio-title')?.focus({ preventScroll: true });
  if (isHome) startHero();
}

function renderAll() {
  applyTheme(initialTheme(content));
  renderBrand();
  renderTicker();
  renderSpine();
  renderFooter();
  go(slugFromHash(), { initial: true });
}

// ---------- Network awareness & offline -----------------------------------------
function watchNetwork() {
  const show = () => {
    const offline = !navigator.onLine;
    els.net.hidden = !offline;
    els.net.textContent = offline ? 'You are offline — showing pages saved on this device. They will refresh when the signal returns.' : '';
  };
  window.addEventListener('online', show);
  window.addEventListener('offline', show);
  show();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        const badge = document.getElementById('offline-ready');
        if (badge) badge.hidden = false;
      })
      .catch((e) => console.warn('Offline support unavailable', e));
  });
}

// ---------- Boot ------------------------------------------------------------------
async function boot() {
  watchNetwork();
  registerServiceWorker();
  try {
    content = await loadContent({
      onUpdate: (fresh) => {
        content = fresh;
        applyTheme(initialTheme(content));
        renderBrand();
        renderTicker();
        renderSpine();
        renderFooter();
        if (current) go(current, { initial: true });
      },
    });
  } catch (e) {
    console.error(e);
    clear(els.page).append(
      h('h1', { class: 'folio-title' }, 'The library is momentarily closed'),
      h('p', {}, 'We could not load the department’s pages. Please check your connection and try again in a moment.'),
      h('button', { class: 'btn btn-ink', type: 'button', onclick: () => location.reload() }, 'Try again'));
    root.classList.remove('is-loading');
    return;
  }

  renderAll();
  root.classList.remove('is-loading');
  startDaylight((d) => hero?.setDaylight(d));
  window.addEventListener('hashchange', () => go(slugFromHash()));
  mountInkwell(content);

  if (rich && els.canvas) {
    const start = () =>
      import('./fx/inkCanvas.js')
        .then(({ startInk }) => startInk(els.canvas))
        .catch((e) => {
          console.warn('Ink canvas disabled', e);
          els.canvas.hidden = true;
        });
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
    else setTimeout(start, 300);
  } else if (els.canvas) {
    els.canvas.hidden = true;
  }
}

boot();
