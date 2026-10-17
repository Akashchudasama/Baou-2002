// Document rows (PDFs and Drive links) shared by the SLM, research and results folios.

import { storageUrl } from '../config.js';
import { documentHref } from '../lib/content.js';
import { h, safeUrl } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

export const CATEGORY_LABEL = {
  slm: 'SLM',
  'study-material': 'Study material',
  assignment: 'Assignment',
  syllabus: 'Syllabus',
  booklet: 'Booklet',
  notice: 'Notice',
  result: 'Result',
  other: 'Document',
};

export function documentUrl(doc) {
  return safeUrl(documentHref(doc, (p) => storageUrl('documents', p)), { allow: ['https:', 'http:'] });
}

const isDrive = (url) => /^https:\/\/(drive|docs)\.google\.com\//.test(url || '');

/** Downloads a PDF hosted on the portal onto the learner's device for offline reading. */
async function saveToDevice(url, title, btn) {
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (blob.type && blob.type !== 'application/pdf') throw new Error('Not a PDF');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(title).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'document'}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 15000);
    btn.textContent = 'Saved on device ✓';
  } catch {
    btn.disabled = false;
    btn.textContent = 'Could not save — retry';
  }
}

export function docLink(doc) {
  const url = documentUrl(doc);
  const size = doc.file_size ? ` · ${(doc.file_size / 1048576).toFixed(1)} MB` : '';
  const meta = [CATEGORY_LABEL[doc.category], doc.program_code, doc.semester ? `Semester ${doc.semester}` : null, doc.course_code, doc.academic_year]
    .filter(Boolean).join(' · ') + size;
  const drive = isDrive(url);
  const save = url && !drive ? h('button', { class: 'chip doc-save', type: 'button', title: 'Download to read offline' }, t('Save offline')) : null;
  save?.addEventListener('click', () => saveToDevice(url, doc.title, save));
  return h('li', { class: 'doc' },
    h('span', { class: 'doc-icon', 'aria-hidden': 'true' }, drive ? 'DRIVE' : 'PDF'),
    h('div', { class: 'doc-main' },
      url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, doc.title) : h('span', {}, doc.title),
      h('small', {}, meta),
      doc.description ? h('small', { class: 'doc-desc' }, doc.description) : null),
    save);
}

/** A list that reveals rows in batches, so hundreds of files never slow the page. */
export function batchedList(items, render, { batch = 20, className = 'docs', emptyText = 'Nothing here yet.' } = {}) {
  const list = h('ul', { class: className });
  const more = h('button', { class: 'btn more', type: 'button' }, t('Show more'));
  let shown = 0;
  const step = () => {
    list.append(...items.slice(shown, shown + batch).map(render));
    shown += batch;
    more.hidden = shown >= items.length;
    more.textContent = `${t('Show more')} (${Math.max(0, items.length - shown)})`;
  };
  more.addEventListener('click', step);
  if (!items.length) return h('p', { class: 'empty' }, emptyText);
  step();
  return h('div', { class: 'batched' }, list, more);
}
