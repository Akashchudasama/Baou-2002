// Practice database: used whenever Supabase is not connected (demo / practice
// mode). It starts from /data/demo-content.json and keeps staff edits in this
// browser's localStorage, so the admin console and the public site can be
// tried end-to-end on one computer with no accounts at all.

const KEY = 'baou-eng-practice-db-v5';

const EXTRA_TABLES = () => ({
  staff: [{ user_id: 'practice-admin', full_name: 'Practice Administrator', email: 'practice@localhost', role: 'admin', active: true, created_at: new Date().toISOString() }],
  helpdesk_tickets: [
    { id: 'tkt-1', reference: 'ENG2610-PRAC0001', name: 'Sample Learner', email: 'learner@example.com', phone: '9800000000', enrolment_no: 'SAMPLE001', program_code: 'MA-ENG', category: 'assignment', subject: 'Cannot find my assignment booklet', message: 'This is a practice ticket. Try replying to it.', status: 'open', public_reply: null, staff_note: null, assigned_to: null, consent_at: new Date(Date.now() - 864e5).toISOString(), created_at: new Date(Date.now() - 864e5).toISOString(), updated_at: new Date(Date.now() - 864e5).toISOString() },
    { id: 'tkt-2', reference: 'ENG2610-PRAC0002', name: 'Sample Learner Two', email: 'learner2@example.com', phone: '9800000001', enrolment_no: 'SAMPLE002', program_code: 'BA-ENG', category: 'study-material', subject: 'SLM for semester 1', message: 'A resolved practice ticket.', status: 'resolved', public_reply: 'The SLM is now in the SLM & Study Material tab.', staff_note: null, assigned_to: null, consent_at: new Date(Date.now() - 3 * 864e5).toISOString(), created_at: new Date(Date.now() - 3 * 864e5).toISOString(), updated_at: new Date(Date.now() - 2 * 864e5).toISOString() },
  ],
  audit_log: [],
});

let cache = null;

export async function loadPracticeDb() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw);
      return cache;
    }
  } catch { /* fall through to the bundled copy */ }
  const res = await fetch('/data/demo-content.json', { cache: 'no-cache' });
  const json = await res.json();
  cache = { ...json.tables, ...EXTRA_TABLES() };
  return cache;
}

export function savePracticeDb(db) {
  cache = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false; // storage full or blocked; changes stay for this tab only
  }
}

export function resetPracticeDb() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function hasPracticeEdits() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

// ---- Public bundle: mirrors public.public_content() in the database ----
const by = (...keys) => (a, b) => {
  for (const k of keys) {
    const [name, dir] = k.startsWith('-') ? [k.slice(1), -1] : [k, 1];
    const x = a[name] ?? '';
    const y = b[name] ?? '';
    if (x < y) return -dir;
    if (x > y) return dir;
  }
  return 0;
};
const strip = (r, extra = []) => {
  const o = { ...r };
  for (const k of ['published', 'created_at', 'updated_at', ...extra]) delete o[k];
  return o;
};
const live = (rows) => (rows || []).filter((r) => r.published !== false);

export function buildPublicContent(db) {
  const now = Date.now();
  const tickets = db.helpdesk_tickets || [];
  return {
    generated_at: new Date().toISOString(),
    demo: true,
    settings: Object.fromEntries((db.site_settings || []).filter((s) => s.is_public !== false).map((s) => [s.key, s.value])),
    sections: live(db.sections).sort(by('sort_order', 'title')).map((r) => strip(r)),
    messages: live(db.messages).sort(by('sort_order')).map((r) => strip(r)),
    announcements: live(db.announcements).filter((a) => !a.ends_at || Date.parse(a.ends_at) > now).sort(by('-priority', 'sort_order')).map((r) => strip(r)),
    programs: live(db.programs).sort(by('sort_order', 'title')).map((r) => strip(r)),
    program_courses: live(db.program_courses).sort(by('program_code', 'semester', 'sort_order', 'course_code')).map((r) => strip(r)),
    enrolments: live(db.enrolments).sort(by('program_code', '-academic_year', 'semester')).map((r) => strip(r)),
    documents: live(db.documents).sort(by('sort_order')).map((r) => strip(r)),
    faculty: live(db.faculty).sort(by('sort_order', 'name')).map((r) => strip(r)),
    pantheon: live(db.pantheon).sort(by('sort_order', 'name')).map((r) => strip(r)),
    toppers: live(db.toppers).filter((t) => t.consent).sort(by('-academic_year', 'program_code', 'rank')).map((r) => strip(r, ['consent'])),
    links: live(db.links).sort(by('placement', 'sort_order', 'label')).map((r) => strip(r)),
    result_notices: live(db.result_notices).sort(by('-published_on', 'sort_order')).map((r) => strip(r)),
    helpdesk_stats: { total: tickets.length, resolved: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length },
    daily: live(db.daily_items).filter((x) => x.status === 'approved').sort(by('kind', 'sort_order', 'title')).map((r) => strip(r, ['status', 'created_by', 'approved_by', 'approved_at'])),
    gallery: live(db.gallery_items).sort(by('-event_date', 'album', 'sort_order')).map((r) => strip(r)),
    alumni: live(db.alumni).filter((a) => a.consent).sort(by('sort_order', 'name')).map((r) => strip(r, ['consent'])),
    demo_knowledge: live(db.knowledge_chunks).map((k) => ({ title: k.title, course_code: k.course_code, content: k.content })),
  };
}
