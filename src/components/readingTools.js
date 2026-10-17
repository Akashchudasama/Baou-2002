// Reading tools (text size and read-aloud) and the English / ગુજરાતી switch.
// Read-aloud uses the voice built into the visitor's own phone or computer
// (Web Speech API): free, nothing is downloaded or sent anywhere.

import { h } from '../lib/dom.js';
import { getLang, setLang, t } from '../lib/i18n.js';

const SIZE_KEY = 'baou-eng-textsize';
const SIZES = [['100', 'Normal'], ['112.5', 'Larger'], ['125', 'Largest']];

function applySize(v) {
  document.documentElement.style.fontSize = v === '100' ? '' : `${v}%`;
  try {
    localStorage.setItem(SIZE_KEY, v);
  } catch { /* ignore */ }
}

function chunks(text) {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?।]+[.!?।]?/g) || [];
  const out = [];
  let buf = '';
  for (const p of parts) {
    if ((buf + p).length > 220) {
      if (buf) out.push(buf);
      buf = p;
    } else buf += p;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export function mountReadingTools(container, getPageEl) {
  let size = '100';
  try {
    size = localStorage.getItem(SIZE_KEY) || '100';
  } catch { /* ignore */ }
  const synth = window.speechSynthesis;
  const status = h('small', { class: 'muted', 'aria-live': 'polite' });

  const sizeBtns = SIZES.map(([v, label]) => {
    const b = h('button', { type: 'button', class: 'seg', role: 'radio', 'aria-checked': String(v === size) }, t(label));
    b.addEventListener('click', () => {
      applySize(v);
      sizeBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    return b;
  });

  const listen = h('button', { class: 'btn btn-ink', type: 'button' }, t('Listen to this page'));
  const pause = h('button', { class: 'btn', type: 'button', hidden: true }, t('Pause'));
  const stop = h('button', { class: 'btn', type: 'button', hidden: true }, t('Stop'));
  const reset = () => {
    pause.hidden = true;
    stop.hidden = true;
    pause.textContent = t('Pause');
    listen.hidden = false;
  };
  listen.addEventListener('click', () => {
    if (!synth) {
      status.textContent = t('Read-aloud is not available in this browser.');
      return;
    }
    synth.cancel();
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang?.startsWith('en'));
    const list = chunks(getPageEl().innerText || '');
    list.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || 'en-IN';
      u.rate = 0.95;
      if (i === list.length - 1) u.onend = reset;
      synth.speak(u);
    });
    listen.hidden = true;
    pause.hidden = false;
    stop.hidden = false;
  });
  pause.addEventListener('click', () => {
    if (synth.paused) {
      synth.resume();
      pause.textContent = t('Pause');
    } else {
      synth.pause();
      pause.textContent = t('Resume');
    }
  });
  stop.addEventListener('click', () => {
    synth?.cancel();
    reset();
  });
  window.addEventListener('hashchange', () => {
    synth?.cancel();
    reset();
  });

  const panel = h('div', { class: 'theme-panel reading-panel', id: 'reading-panel', role: 'dialog', 'aria-label': t('Reading tools'), hidden: true },
    h('p', { class: 'mini' }, t('Text size')),
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t('Text size') }, sizeBtns),
    h('p', { class: 'mini' }, t('Reading tools')),
    h('div', { class: 'reading-actions' }, listen, pause, stop),
    status);
  const btn = h('button', { class: 'theme-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'reading-panel', title: t('Reading tools') },
    h('span', { class: 'aa', 'aria-hidden': 'true' }, 'Aa'), h('span', {}, t('Reading tools')));
  const close = () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      btn.focus();
    }
  });

  const lang = getLang();
  const langBtn = h('button', { class: 'theme-btn lang-btn', type: 'button', lang: lang === 'gu' ? 'en' : 'gu',
    title: lang === 'gu' ? 'Switch to English' : 'ગુજરાતીમાં જુઓ' }, lang === 'gu' ? 'English' : 'ગુજરાતી');
  langBtn.addEventListener('click', () => {
    setLang(lang === 'gu' ? 'en' : 'gu');
    location.reload();
  });

  container.prepend(langBtn, h('div', { class: 'theme-picker' }, btn, panel));
}
