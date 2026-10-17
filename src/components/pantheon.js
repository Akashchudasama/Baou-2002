// Literary Pantheon: sepia portrait medallions that open a floating 3D
// marginalia card (verse, translation, Indian Knowledge Systems context).

import { storageUrl } from '../config.js';
import { h, lines, paragraphs } from '../lib/dom.js';
import { medallion } from './medallion.js';
import { t } from '../lib/i18n.js';

let dialog;
let card;
let lastTrigger;

function ensureDialog() {
  if (dialog) return dialog;
  card = h('article', { class: 'marginalia-card' });
  dialog = h('dialog', { class: 'marginalia', 'aria-labelledby': 'marginalia-name' }, card);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-dialog');
    lastTrigger?.focus();
  });
  // gentle 3D tilt that follows the pointer (desktop only)
  dialog.addEventListener('pointermove', (e) => {
    if (document.documentElement.dataset.fx !== 'full') return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
  });
  dialog.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
  document.body.append(dialog);
  return dialog;
}

function open(person, trigger) {
  ensureDialog();
  lastTrigger = trigger;
  card.replaceChildren(...[
    h('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, '×'),
    h('div', { class: 'marg-head' },
      medallion(person.name, storageUrl('media', person.portrait_path), 'medallion sepia'),
      h('div', {},
        h('p', { class: 'kicker' }, [person.tradition, person.era].filter(Boolean).join(' · ')),
        h('h2', { id: 'marginalia-name', class: 'marg-name' }, person.name))),
    person.verse
      ? h('blockquote', { class: 'marg-verse' }, h('p', {}, lines(person.verse)), person.verse_source ? h('cite', {}, person.verse_source) : null)
      : person.verse_source
        ? h('p', { class: 'marg-work' }, h('span', { class: 'mini' }, 'Signature work · '), person.verse_source)
        : null,
    person.translation ? h('p', { class: 'marg-translation' }, person.translation) : null,
    person.iks_context
      ? h('section', { class: 'marg-iks' }, h('h3', { class: 'mini' }, 'Marginalia · Indian Knowledge Systems'), paragraphs(person.iks_context))
      : null,
  ].filter(Boolean));
  card.style.setProperty('--rx', '0deg');
  card.style.setProperty('--ry', '0deg');
  document.documentElement.classList.add('has-dialog');
  dialog.showModal();
}

export function renderPantheon(people) {
  return h('section', { class: 'pantheon', 'aria-labelledby': 'pantheon-title' },
    h('h2', { class: 'section-title', id: 'pantheon-title' }, t('The Literary Pantheon')),
    h('p', { class: 'muted' }, t('Canonical and vernacular voices in conversation. Select a portrait to open its marginalia.')),
    h('ul', { class: 'pantheon-row' }, people.map((p) =>
      h('li', {},
        h('button', {
          class: 'portrait', type: 'button',
          onclick: (e) => open(p, e.currentTarget),
          'aria-haspopup': 'dialog',
        },
        medallion(p.name, storageUrl('media', p.portrait_path), 'medallion sepia'),
        h('span', { class: 'portrait-name' }, p.name),
        p.tradition ? h('span', { class: 'portrait-trad' }, p.tradition) : null)))));
}
