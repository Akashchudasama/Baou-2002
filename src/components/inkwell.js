// Ask the Muse — a desk lamp and inkwell (labelled on the bottle) that open an AI study
// companion drawer. Answers come from the `inkwell` Edge Function, grounded
// in the department's published programmes, documents and knowledge base.

import { DEMO_MODE, functionUrl, publicHeaders } from '../config.js';
import { setting } from '../lib/content.js';
import { h, paragraphs, s } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

const HISTORY_KEY = 'baou-eng-inkwell';

function lampAndInkwell() {
  // Colours come from the active theme via CSS classes (see portal.css).
  return s('svg', { viewBox: '0 0 120 110', class: 'inkwell-art', 'aria-hidden': 'true' },
    s('defs', {},
      s('radialGradient', { id: 'lampglow', cx: '0.5', cy: '0', r: '1' },
        s('stop', { offset: '0', class: 'iw-glow-stop', 'stop-opacity': '0.95' }),
        s('stop', { offset: '1', class: 'iw-glow-stop', 'stop-opacity': '0' }))),
    s('path', { class: 'lamp-light', d: 'M40 34 L10 100 H96 L66 34 Z', fill: 'url(#lampglow)' }),
    s('path', { class: 'iw-accent iw-brass-stroke', d: 'M28 36 Q53 8 78 36 Z', 'stroke-width': '1.6' }),
    s('rect', { class: 'iw-brass', x: '50', y: '14', width: '6', height: '6', rx: '1' }),
    s('path', { class: 'iw-brass-stroke', d: 'M53 20 V8 Q53 4 60 4 H86 Q92 4 92 10 V96', fill: 'none', 'stroke-width': '2.4', 'stroke-linecap': 'round' }),
    s('ellipse', { class: 'iw-brass', cx: '92', cy: '99', rx: '14', ry: '4' }),
    s('path', { class: 'iw-ink iw-brass-stroke', d: 'M22 98 Q20 80 30 76 H50 Q60 80 58 98 Z', 'stroke-width': '1.6' }),
    s('rect', { class: 'iw-brass', x: '33', y: '70', width: '14', height: '7', rx: '1.5' }),
    s('path', { class: 'quill iw-paper iw-brass-stroke', d: 'M40 72 L18 22 Q30 26 34 40 Q38 52 41 70 Z', 'stroke-width': '1' }),
    s('path', { class: 'iw-brass-stroke', d: 'M40 72 L22 30', 'stroke-width': '0.8' }));
}

function localAnswer(question, content) {
  const words = (question.toLowerCase().match(/[a-zऀ-૿]{3,}/g) || []).filter((w) => !['what', 'the', 'and', 'for', 'how', 'where', 'who', 'which', 'about', 'with', 'this', 'that', 'does', 'can'].includes(w));
  const pool = [
    ...(content.demo_knowledge || []).map((k) => ({ title: k.title, body: k.content, source: 'knowledge' })),
    ...content.programs.map((p) => ({ title: `${p.code} — ${p.title}`, body: [p.description, p.eligibility, p.duration].filter(Boolean).join(' '), source: 'programme' })),
  ];
  const scored = pool
    .map((d) => ({ ...d, score: words.reduce((n, w) => n + (d.title.toLowerCase().includes(w) ? 3 : 0) + (d.body.toLowerCase().includes(w) ? 1 : 0), 0) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  if (!scored.length) {
    return { answer: 'I could not find that in the department’s published material yet. Please raise a query in the Helpdesk section.', sources: [], mode: 'library' };
  }
  const answer = scored.map((d) => `${d.title}: ${d.body.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')}`).join('\n\n');
  return { answer: `From the department’s material (demo mode, no AI):\n\n${answer}`, sources: scored.map(({ title, source }) => ({ title, source })), mode: 'library' };
}

async function ask(question, history, content) {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 450));
    return localAnswer(question, content);
  }
  const res = await fetch(functionUrl('inkwell'), {
    method: 'POST',
    headers: publicHeaders(),
    body: JSON.stringify({ question, history: history.slice(-6) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The Muse is resting just now. Please try again shortly.');
  return data;
}

export function mountInkwell(content) {
  const museName = t(setting(content, 'inkwell_name', 'Ask the Muse'));
  let history = [];
  try {
    history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]').slice(-12);
  } catch { /* ignore */ }
  const save = () => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-12)));
    } catch { /* ignore */ }
  };

  const log = h('div', { class: 'ink-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const input = h('textarea', { class: 'ink-input', rows: '2', maxlength: '600', placeholder: t('Ask about a programme, unit or text…'), 'aria-label': 'Your question' });
  const send = h('button', { class: 'btn btn-ink', type: 'submit' }, 'Ask');
  const form = h('form', { class: 'ink-form' }, input, send);

  const bubble = (role, text, extra) =>
    h('div', { class: `ink-msg ${role}` },
      role === 'assistant' ? h('span', { class: 'ink-who' }, t('The Muse')) : null,
      paragraphs(String(text).split(/\n{2,}/)),
      extra || null);

  const greeting = setting(content, 'inkwell_greeting', 'Ask me about your programme, study material and the texts you are reading.');
  const suggestions = setting(content, 'inkwell_suggestions', []);
  const chips = Array.isArray(suggestions) && suggestions.length
    ? h('div', { class: 'chips ink-suggest' }, suggestions.slice(0, 5).map((q) =>
        h('button', { type: 'button', class: 'chip', onclick: () => { input.value = q; form.requestSubmit(); } }, q)))
    : null;

  function renderLog() {
    log.replaceChildren(bubble('assistant', greeting, chips), ...history.map((t) => bubble(t.role, t.text)));
    log.scrollTop = log.scrollHeight;
  }

  const drawer = h('aside', { class: 'ink-drawer', id: 'ink-drawer', 'aria-label': museName, hidden: true },
    h('header', { class: 'ink-head' },
      h('div', {}, h('p', { class: 'kicker' }, t('Study companion')), h('h2', { class: 'ink-title' }, museName)),
      h('div', { class: 'ink-tools' },
        h('button', { class: 'icon-btn', type: 'button', title: t('Clear conversation'), 'aria-label': t('Clear conversation'), onclick: () => { history = []; save(); renderLog(); } }, '↺'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => toggle(false) }, '×'))),
    log,
    form,
    h('p', { class: 'ink-note' }, t('Answers draw on the department’s published material. For official decisions, rely on university notices.')));

  const launcher = h('button', { class: 'inkwell-launcher', type: 'button', 'aria-controls': 'ink-drawer', 'aria-expanded': 'false', title: museName },
    lampAndInkwell(), h('span', { class: 'muse-tag', 'aria-hidden': 'true' }, museName), h('span', { class: 'sr-only' }, museName));

  function toggle(open = drawer.hidden) {
    drawer.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('ink-open', open);
    if (open) {
      renderLog();
      setTimeout(() => input.focus(), 50);
    } else launcher.focus();
  }

  launcher.addEventListener('click', () => toggle());
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length < 3 || send.disabled) return;
    input.value = '';
    history.push({ role: 'user', text: q });
    renderLog();
    const thinking = h('div', { class: 'ink-msg assistant thinking' }, h('span', { class: 'ink-who' }, t('The Muse')), h('span', { class: 'quill-dots' }, 'The Muse is thinking'));
    log.append(thinking);
    log.scrollTop = log.scrollHeight;
    send.disabled = true;
    try {
      const out = await ask(q, history.slice(0, -1), content);
      history.push({ role: 'assistant', text: out.answer });
      save();
      renderLog();
      if (out.sources?.length) {
        log.lastElementChild.append(h('p', { class: 'ink-sources' }, 'Sources: ', out.sources.map((x) => x.title).join(' · ')));
      }
    } catch (err) {
      thinking.remove();
      log.append(bubble('assistant', err.message));
      history.pop();
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  document.body.append(launcher, drawer);
  return { toggle };
}
