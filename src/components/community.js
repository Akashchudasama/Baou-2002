// Events & Gallery and Alumni pages. Both tabs stay hidden until the
// department publishes them under Pages & Navigation in the admin console.

import { storageUrl } from '../config.js';
import { fmtDate, h, paragraphs } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { medallion } from './medallion.js';

const saver = () => document.documentElement.dataset.fx === 'saver';
const put = (el, ...nodes) => el.replaceChildren(...nodes.flat(Infinity).filter(Boolean));

// ---------- Lightbox -----------------------------------------------------------------
let box;
let items = [];
let index = 0;
let lastTrigger;

function ensureBox() {
  if (box) return box;
  box = h('dialog', { class: 'lightbox', 'aria-label': t('Events & Gallery') });
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
  });
  box.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog');
    lastTrigger?.focus();
  });
  document.body.append(box);
  return box;
}

function show(i) {
  index = (i + items.length) % items.length;
  const it = items[index];
  const url = storageUrl('media', it.image_path);
  const many = items.length > 1;
  put(box, h('figure', { class: 'lightbox-figure' },
    h('button', { class: 'close', type: 'button', 'aria-label': t('Close'), onclick: () => box.close() }, '×'),
    url ? h('img', { src: url, alt: it.title || it.caption || it.album, decoding: 'async' })
      : h('div', { class: 'photo-placeholder large' }, h('span', {}, it.title || it.album)),
    h('figcaption', {},
      it.title ? h('strong', {}, it.title) : null,
      it.caption ? h('span', {}, it.caption) : null,
      h('small', { class: 'meta' }, [it.album, it.event_date ? fmtDate(it.event_date) : null].filter(Boolean).join(' · '),
        many ? ` · ${index + 1} / ${items.length}` : '')),
    many ? h('div', { class: 'lightbox-nav' },
      h('button', { class: 'btn', type: 'button', onclick: () => show(index - 1) }, `‹ ${t('Previous')}`),
      h('button', { class: 'btn', type: 'button', onclick: () => show(index + 1) }, `${t('Next')} ›`)) : null));
}

function openLightbox(list, i, trigger) {
  items = list;
  lastTrigger = trigger;
  ensureBox();
  show(i);
  document.documentElement.classList.add('has-dialog');
  box.showModal();
}

// ---------- Gallery ----------------------------------------------------------------
function thumb(it, list, i) {
  const url = storageUrl('media', it.image_path);
  const label = it.title || it.caption || `${it.album} — ${i + 1}`;
  const btn = h('button', { class: 'gallery-thumb', type: 'button', 'aria-label': label },
    url ? h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async', width: '320', height: '220' })
      : h('span', { class: 'photo-placeholder' }, h('span', {}, it.title || '❦')));
  btn.addEventListener('click', () => openLightbox(list, i, btn));
  return btn;
}

function album(name, list) {
  const date = list.find((x) => x.event_date)?.event_date;
  const limit = saver() ? 4 : 12;
  const grid = h('div', { class: 'gallery-grid' });
  const render = (n) => put(grid, list.slice(0, n).map((it, i) => thumb(it, list, i)));
  render(limit);
  const more = list.length > limit
    ? h('button', { class: 'btn', type: 'button', onclick: (e) => { render(list.length); e.currentTarget.remove(); } }, `${t('Show all')} (${list.length})`)
    : null;
  return h('section', { class: 'shelf-section album' },
    h('div', { class: 'row-between' },
      h('h2', { class: 'section-title' }, name),
      date ? h('span', { class: 'meta' }, fmtDate(date)) : null),
    grid, more);
}

export function renderGallery(section, content) {
  const rows = content.gallery || [];
  const intro = section.body?.length ? h('div', { class: 'prose' }, paragraphs(section.body)) : null;
  if (!rows.length) return [intro, h('p', { class: 'empty' }, t('Photographs will appear here after the next event.'))];
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.album)) groups.set(r.album, []);
    groups.get(r.album).push(r);
  }
  return [intro, [...groups].map(([name, list]) => album(name, list))];
}

// ---------- Alumni -----------------------------------------------------------------
export function renderAlumni(section, content) {
  const rows = content.alumni || [];
  const programmes = new Map((content.programs || []).map((p) => [p.code, p.title]));
  const intro = section.body?.length ? h('div', { class: 'prose' }, paragraphs(section.body)) : null;
  if (!rows.length) return [intro, h('p', { class: 'empty' }, t('Alumni stories will appear here soon.'))];
  return [intro, h('div', { class: 'alumni-grid' }, rows.map((a) => h('article', { class: 'card alumni-card' },
    h('header', { class: 'alumni-head' },
      medallion(a.name, storageUrl('media', a.photo_path), 'medallion sepia'),
      h('div', {},
        h('h3', { class: 'card-title small' }, a.name),
        h('p', { class: 'meta' }, [programmes.get(a.program_code) || a.program_code, a.batch].filter(Boolean).join(' · ')),
        a.present_role ? h('p', { class: 'alumni-role' }, a.present_role) : null)),
    a.message ? h('blockquote', { class: 'alumni-quote' }, a.message) : null)))];
}
