// Tiny, XSS-safe DOM builder. Dynamic text is only ever assigned through
// textContent / attributes — innerHTML is never used with data.

const SVG_NS = 'http://www.w3.org/2000/svg';
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href']);

/** Returns a safe absolute/relative URL or null. Blocks javascript:, data:, etc. */
export function safeUrl(value, { allow = ['https:', 'http:', 'mailto:', 'tel:'] } = {}) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.startsWith('#') || (s.startsWith('/') && !s.startsWith('//'))) return s;
  try {
    const u = new URL(s, window.location.origin);
    return allow.includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function apply(el, props, isSvg) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') {
      if (isSvg) el.setAttribute('class', v);
      else el.className = v;
    } else if (k === 'text') {
      el.textContent = String(v);
    } else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'innerHTML' || k === 'outerHTML') {
      throw new Error('Unsafe property');
    } else if (URL_ATTRS.has(k)) {
      const u = safeUrl(v);
      if (u) el.setAttribute(k, u);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props, false);
  append(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props, true);
  append(el, children);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Splits text into paragraphs on blank lines / newlines, as <p> elements. */
export function paragraphs(text, className) {
  if (!text) return [];
  const parts = Array.isArray(text) ? text : String(text).split(/\n{2,}|\r\n\r\n/);
  return parts.filter((p) => String(p).trim()).map((p) => h('p', { class: className }, String(p).trim()));
}

/** Text with single line-breaks preserved (verses). */
export function lines(text, className) {
  const el = h('span', { class: className });
  String(text || '')
    .split('\n')
    .forEach((line, i) => {
      if (i) el.append(document.createElement('br'));
      el.append(document.createTextNode(line));
    });
  return el;
}

export function fmtDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', opts);
}

export function initials(name) {
  return String(name || '')
    .replace(/\(.*?\)|Prof\.|Dr\.|Shri|Smt\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
