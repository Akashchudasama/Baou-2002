// Input sanitisation. Everything user-supplied is reduced to plain text:
// no markup survives, so nothing can execute when staff view it (defence in
// depth — the admin UI also renders with textContent only).

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

export function cleanText(input: unknown, max: number, { multiline = false } = {}): string {
  if (typeof input !== 'string') return '';
  let s = input.normalize('NFC').replace(CONTROL, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ');
  s = s.replace(/<[^>]*>/g, ' '); // strip remaining tags
  s = s.replace(/javascript\s*:/gi, '').replace(/data\s*:\s*text\/html/gi, '');
  s = multiline
    ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : s.replace(/\s+/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function isEmail(s: string): boolean {
  return s.length <= 254 && /^[^@\s<>()"']+@[^@\s<>()"']+\.[A-Za-z]{2,}$/.test(s);
}

export function oneOf<T extends string>(v: unknown, options: readonly T[]): T | null {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : null;
}
