// Faculty folio (cards that open a full profile) and the PhD & Research folio
// (research guides and the department's booklet shelf).

import { storageUrl } from '../config.js';
import { linksFor } from '../lib/content.js';
import { h, paragraphs, safeUrl } from '../lib/dom.js';
import { documentUrl } from './docs.js';
import { medallion } from './medallion.js';
import { t } from '../lib/i18n.js';

let dialog;
let lastTrigger;

function openSheet(nodes, labelId) {
  if (!dialog) {
    dialog = h('dialog', { class: 'marginalia profile-dialog' });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('has-dialog');
      lastTrigger?.focus();
    });
    document.body.append(dialog);
  }
  dialog.setAttribute('aria-labelledby', labelId);
  dialog.replaceChildren(h('article', { class: 'marginalia-card' },
    h('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, '×'),
    ...nodes.filter(Boolean)));
  document.documentElement.classList.add('has-dialog');
  dialog.showModal();
}

const listBlock = (title, items) => (items?.length ? h('section', { class: 'profile-block' }, h('h3', { class: 'mini' }, title), h('ul', {}, items.map((x) => h('li', {}, x)))) : null);

function profile(f, trigger) {
  lastTrigger = trigger;
  const mail = f.email ? safeUrl(`mailto:${f.email}`) : null;
  openSheet([
    h('div', { class: 'marg-head' },
      medallion(f.name, storageUrl('media', f.photo_path), 'medallion'),
      h('div', {},
        f.designation ? h('p', { class: 'kicker' }, f.designation) : null,
        h('h2', { class: 'marg-name', id: 'profile-name' }, f.name),
        f.specialisation ? h('p', { class: 'byline' }, f.specialisation) : null)),
    f.qualifications ? h('p', { class: 'meta' }, f.qualifications) : null,
    f.bio ? h('div', { class: 'prose' }, paragraphs(f.bio)) : null,
    f.research_areas ? h('p', {}, h('span', { class: 'mini' }, 'Research areas · '), f.research_areas) : null,
    f.is_phd_guide ? h('p', { class: 'guide-line' }, `PhD research guide · ${f.phd_completed || 0} PhD${f.phd_completed === 1 ? '' : 's'} completed under guidance`) : null,
    listBlock('Publications', f.publications),
    listBlock('Books', f.books),
    listBlock('Self-Learning Material written', f.slms_written),
    listBlock('Awards and honours', f.awards),
    mail ? h('p', {}, h('a', { href: mail, class: 'link' }, f.email)) : null,
  ], 'profile-name');
}

export function renderFaculty(section, c) {
  if (!c.faculty.length) return h('p', { class: 'empty' }, 'Faculty profiles will be published soon.');
  return h('div', { class: 'grid grid-3' }, c.faculty.map((f) => {
    const card = h('button', { class: 'card faculty profile-card', type: 'button', 'aria-haspopup': 'dialog' },
      medallion(f.name, storageUrl('media', f.photo_path)),
      h('span', { class: 'card-title small' }, f.name),
      f.designation ? h('span', { class: 'byline' }, f.designation) : null,
      f.specialisation ? h('span', { class: 'meta' }, f.specialisation) : null,
      h('span', { class: 'view-profile' }, t('View profile →')));
    card.addEventListener('click', () => profile(f, card));
    return card;
  }));
}

function cover(doc) {
  const img = storageUrl('media', doc.cover_path);
  const url = documentUrl(doc);
  return h('li', {},
    h('a', { class: 'booklet', href: url || '#', target: url ? '_blank' : null, rel: 'noopener', 'aria-label': doc.title },
      img ? h('img', { src: img, alt: '', loading: 'lazy' })
        : h('span', { class: 'booklet-face' }, h('span', { class: 'booklet-orn', 'aria-hidden': 'true' }, '❦'), h('span', { class: 'booklet-title' }, doc.title))),
    h('p', { class: 'booklet-caption' }, doc.title),
    doc.description ? h('small', { class: 'muted' }, doc.description) : null);
}

export function renderResearch(section, c) {
  const guides = c.faculty.filter((f) => f.is_phd_guide);
  const booklets = c.documents.filter((d) => d.category === 'booklet');
  const phd = c.programs.find((p) => p.level_group === 'phd');
  const links = linksFor(c, 'research');
  return [
    phd ? h('p', { class: 'callout' }, h('strong', {}, phd.title), ' — ', phd.eligibility || phd.description || '', ' ',
      h('a', { href: '#/programmes', class: 'link' }, 'See it on the programme shelf')) : null,
    links.length ? h('div', { class: 'lms-bar' }, links.map((l) => h('a', { class: 'chip', href: safeUrl(l.url), target: '_blank', rel: 'noopener' }, l.label))) : null,
    h('section', { class: 'shelf-section' },
      h('h2', { class: 'section-title' }, t('Research guides')),
      guides.length
        ? h('div', { class: 'grid grid-3' }, guides.map((f) => {
            const card = h('button', { class: 'card faculty profile-card', type: 'button', 'aria-haspopup': 'dialog' },
              medallion(f.name, storageUrl('media', f.photo_path)),
              h('span', { class: 'card-title small' }, f.name),
              f.research_areas ? h('span', { class: 'meta' }, f.research_areas) : null,
              h('span', { class: 'guide-count' }, h('strong', {}, String(f.phd_completed || 0)), ` PhD${f.phd_completed === 1 ? '' : 's'} completed`));
            card.addEventListener('click', () => profile(f, card));
            return card;
          }))
        : h('p', { class: 'empty' }, 'The list of research guides will be published soon.')),
    h('section', { class: 'shelf-section' },
      h('h2', { class: 'section-title' }, t('Our booklets')),
      h('p', { class: 'muted' }, 'Guides on reading literature, applying theory, writing answers and preparing for each stage of study.'),
      booklets.length ? h('ul', { class: 'booklet-shelf' }, booklets.map(cover)) : h('p', { class: 'empty' }, 'Booklets will be added here soon.')),
  ];
}
