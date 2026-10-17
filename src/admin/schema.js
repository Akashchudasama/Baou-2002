// Declarative description of every editable collection. The admin console
// builds its lists and forms from this — adding a field here (and a column in
// the database) is all it takes to make it editable by staff.

const EDIT = ['admin', 'editor'];

const published = { name: 'published', label: 'Show on website', type: 'bool', default: true };
const order = { name: 'sort_order', label: 'Display order (lower first)', type: 'number', default: 0 };

export const DOC_CATEGORIES = [
  ['slm', 'SLM (Self-Learning Material)'],
  ['study-material', 'Study material'],
  ['assignment', 'Assignment booklet'],
  ['syllabus', 'Syllabus'],
  ['booklet', 'Department booklet (PhD & Research shelf)'],
  ['notice', 'Notice / circular'],
  ['result', 'Result'],
  ['other', 'Other'],
];

export const LEVELS = [
  ['ba', 'B.A.'],
  ['ma', 'M.A.'],
  ['diploma', 'Diploma'],
  ['certificate', 'Certificate'],
  ['phd', 'PhD'],
];

export const PLACEMENTS = [
  ['programme', 'Programme books (Useful links strip)'],
  ['slm', 'SLM & Study Material tab'],
  ['results', 'Results tab'],
  ['research', 'PhD & Research tab'],
  ['helpdesk', 'Helpdesk tab'],
  ['home', 'Home page'],
  ['footer', 'Footer (university links)'],
  ['social', 'Footer (social media)'],
];

const programmeOptions = { table: 'programs', value: 'code', label: (r) => `${r.code} — ${r.title}` };

export const RENDERERS = [
  ['home', 'Home (hero, Vice Chancellor’s message, notices, pantheon)'],
  ['programs', 'Programme shelf'],
  ['slm', 'SLM & study material'],
  ['faculty', 'Faculty'],
  ['research', 'PhD & Research'],
  ['results', 'Results & top achievers'],
  ['helpdesk', 'Helpdesk forms'],
  ['gallery', 'Events & Gallery (coming later)'],
  ['alumni', 'Alumni (coming later)'],
  ['text', 'Plain text page'],
];

export const MODULES = [
  {
    id: 'messages', label: 'Leadership Messages', icon: '❦', table: 'messages', roles: EDIT,
    help: 'Messages shown on the Home page, such as the Vice Chancellor’s message. Leave a blank line between paragraphs; the first two paragraphs show at once and the rest open with “Read the full message”.',
    order: [['sort_order', true]],
    list: ['heading', 'author_name', 'published'],
    fields: [
      { name: 'heading', label: 'Heading (e.g. From the Vice Chancellor’s Desk)', type: 'text', required: true, max: 120 },
      { name: 'author_name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'designation', label: 'Designation', type: 'text', max: 160 },
      { name: 'body', label: 'Message', type: 'textarea', required: true, max: 6000, rows: 12 },
      { name: 'signature', label: 'Signature line', type: 'text', max: 120 },
      { name: 'photo_path', label: 'Photograph (JPG/PNG/WebP, max 5 MB)', type: 'file', bucket: 'media', kind: 'image', folder: 'messages' },
      order, published,
    ],
  },
  {
    id: 'announcements', label: 'Announcements & Ticker', icon: '✶', table: 'announcements', roles: EDIT,
    help: 'Headlines scroll in the ticker and appear on the Notice Board. Set an end date to retire a notice automatically.',
    order: [['priority', false], ['created_at', false]],
    list: ['title', 'starts_at', 'ends_at', 'published'],
    fields: [
      { name: 'title', label: 'Headline', type: 'text', required: true, max: 200 },
      { name: 'body', label: 'Details (optional)', type: 'textarea', max: 2000 },
      { name: 'link_url', label: 'Link (must start with https://)', type: 'url' },
      { name: 'priority', label: 'Priority (higher shows first)', type: 'number', default: 0 },
      { name: 'starts_at', label: 'Show from', type: 'datetime' },
      { name: 'ends_at', label: 'Show until', type: 'datetime' },
      published,
    ],
  },
  {
    id: 'documents', label: 'SLM, Study Material & PDFs', icon: '❏', table: 'documents', roles: EDIT,
    help: 'Upload a PDF (max 20 MB) or paste a Google Drive link (sharing: “Anyone with the link can view”, from a department account). SLM, study material and assignments appear in the SLM tab; booklets appear on the PhD & Research shelf.',
    order: [['created_at', false]],
    list: ['title', 'category', 'program_code', 'semester', 'published'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 200 },
      { name: 'category', label: 'Category', type: 'select', options: DOC_CATEGORIES, required: true },
      { name: 'program_code', label: 'Programme', type: 'select', optionsFrom: programmeOptions, blank: 'All / not specific' },
      { name: 'semester', label: 'Semester (optional)', type: 'number', min: 1, max: 10 },
      { name: 'course_code', label: 'Course code (e.g. MEG-101)', type: 'text', max: 30 },
      { name: 'academic_year', label: 'Academic year (e.g. 2026-27)', type: 'text', pattern: '^[0-9]{4}(-[0-9]{2,4})?$', max: 9 },
      { name: 'description', label: 'Short description', type: 'textarea', max: 600 },
      { name: 'external_url', label: 'Google Drive or other https link', type: 'url', hint: 'Use this OR upload a PDF below.' },
      { name: 'file_path', label: 'PDF file', type: 'file', bucket: 'documents', kind: 'pdf', sizeField: 'file_size', folderFrom: 'category', requiredUnless: 'external_url' },
      { name: 'cover_path', label: 'Cover image (booklets only, optional)', type: 'file', bucket: 'media', kind: 'image', folder: 'covers' },
      order, published,
    ],
  },

  {
    id: 'programs', label: 'Programmes', icon: '❧', table: 'programs', roles: EDIT,
    help: 'Each programme is a book on the shelf. Its pages: At a glance (details), What you’ll study (Programme Courses), Our learners (Enrolment) and Where it can lead (future scope below).',
    order: [['sort_order', true]],
    list: ['code', 'title', 'level_group', 'published'],
    fields: [
      { name: 'code', label: 'Programme code', type: 'text', required: true, pattern: '^[A-Za-z0-9-]{2,20}$', max: 20, hint: 'Letters, digits and hyphens, e.g. MA-ENG' },
      { name: 'title', label: 'Title', type: 'text', required: true, max: 160 },
      { name: 'level_group', label: 'Shelf (level)', type: 'select', options: LEVELS, required: true, default: 'ma' },
      { name: 'level', label: 'Level line (e.g. Postgraduate · NEP 2020)', type: 'text', max: 80 },
      { name: 'duration', label: 'Duration', type: 'text', max: 120 },
      { name: 'medium', label: 'Medium', type: 'text', max: 80 },
      { name: 'eligibility', label: 'Eligibility', type: 'textarea', max: 600 },
      { name: 'fees_note', label: 'Fees (short note or “See university website”)', type: 'text', max: 300 },
      { name: 'status', label: 'Status line (e.g. Admissions open)', type: 'text', max: 60 },
      { name: 'description', label: 'Description', type: 'textarea', max: 4000, rows: 6 },
      { name: 'highlights', label: 'Highlights (one per line)', type: 'lines' },
      { name: 'future_scope', label: 'Where it can lead — future scope (one point per line; general, factual, no promises)', type: 'lines' },
      order, published,
    ],
  },
  {
    id: 'program_courses', label: 'Programme Courses', icon: '☷', table: 'program_courses', roles: EDIT,
    help: 'The “What you’ll study” page of each programme book, semester by semester.',
    order: [['program_code', true], ['semester', true], ['sort_order', true]],
    list: ['program_code', 'semester', 'course_code', 'title', 'published'],
    fields: [
      { name: 'program_code', label: 'Programme', type: 'select', optionsFrom: programmeOptions, required: true },
      { name: 'semester', label: 'Semester', type: 'number', required: true, min: 1, max: 10 },
      { name: 'course_code', label: 'Course code', type: 'text', max: 30 },
      { name: 'title', label: 'Course title', type: 'text', required: true, max: 200 },
      { name: 'course_type', label: 'Type (e.g. Major, Minor, Elective)', type: 'text', max: 60 },
      { name: 'credits', label: 'Credits', type: 'number', min: 0, max: 40, step: 'any' },
      order, published,
    ],
  },
  {
    id: 'toppers', label: 'Top Achievers', icon: '✪', table: 'toppers', roles: EDIT,
    help: 'Top five learners per programme and year. Publish a learner’s name and marks only after receiving their written consent.',
    order: [['academic_year', false], ['program_code', true], ['rank', true]],
    list: ['academic_year', 'program_code', 'rank', 'student_name', 'percentage', 'published'],
    fields: [
      { name: 'program_code', label: 'Programme', type: 'select', optionsFrom: programmeOptions, required: true },
      { name: 'academic_year', label: 'Academic year (e.g. 2025-26)', type: 'text', required: true, pattern: '^[0-9]{4}(-[0-9]{2,4})?$', max: 9 },
      { name: 'rank', label: 'Rank (1–5)', type: 'number', required: true, min: 1, max: 5 },
      { name: 'student_name', label: 'Learner’s name', type: 'text', required: true, max: 120 },
      { name: 'percentage', label: 'Percentage', type: 'number', required: true, min: 0, max: 100, step: '0.01' },
      { name: 'consent', label: 'Written consent received from the learner to publish name and marks', type: 'bool', default: false, mustBeTrue: true },
      published,
    ],
  },
  {
    id: 'links', label: 'Links', icon: '⇗', table: 'links', roles: EDIT,
    help: 'Exam form, assignment portal, results, university website, social media… choose where each link appears.',
    order: [['placement', true], ['sort_order', true]],
    list: ['label', 'placement', 'program_code', 'published'],
    fields: [
      { name: 'label', label: 'Button text', type: 'text', required: true, max: 80 },
      { name: 'url', label: 'Address (https://…)', type: 'url', required: true },
      { name: 'placement', label: 'Show on', type: 'select', options: PLACEMENTS, required: true },
      { name: 'program_code', label: 'Only for this programme (optional)', type: 'select', optionsFrom: programmeOptions, blank: 'All programmes' },
      order, published,
    ],
  },


  {
    id: 'faculty', label: 'Faculty Profiles', icon: '♙', table: 'faculty', roles: EDIT,
    help: 'Each card opens a full profile. Lists take one item per line. Tick “PhD research guide” to show the person on the PhD & Research tab.',
    order: [['sort_order', true]],
    list: ['name', 'designation', 'is_phd_guide', 'published'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'designation', label: 'Designation', type: 'text', max: 120 },
      { name: 'specialisation', label: 'Specialisation', type: 'text', max: 300 },
      { name: 'qualifications', label: 'Qualifications', type: 'textarea', max: 600 },
      { name: 'research_areas', label: 'Research areas', type: 'text', max: 400 },
      { name: 'bio', label: 'Short profile', type: 'textarea', max: 2000, rows: 5 },
      { name: 'publications', label: 'Publications (one per line)', type: 'lines' },
      { name: 'books', label: 'Books (one per line)', type: 'lines' },
      { name: 'slms_written', label: 'SLMs written (one per line)', type: 'lines' },
      { name: 'awards', label: 'Awards and honours (one per line)', type: 'lines' },
      { name: 'is_phd_guide', label: 'PhD research guide', type: 'bool', default: false },
      { name: 'phd_completed', label: 'PhDs completed under guidance', type: 'number', min: 0, max: 200, default: 0 },
      { name: 'email', label: 'Public email (optional)', type: 'email' },
      { name: 'photo_path', label: 'Photograph (JPG/PNG/WebP, max 5 MB)', type: 'file', bucket: 'media', kind: 'image', folder: 'faculty' },
      order, published,
    ],
  },

  {
    id: 'pantheon', label: 'Literary Pantheon', icon: '✒', table: 'pantheon', roles: EDIT,
    help: 'Portraits are shown sepia-toned. Use only public-domain or licensed images, and only public-domain verses.',
    order: [['sort_order', true]],
    list: ['name', 'tradition', 'era', 'published'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'tradition', label: 'Tradition / language', type: 'text', max: 120 },
      { name: 'era', label: 'Era / dates', type: 'text', max: 80 },
      { name: 'portrait_path', label: 'Portrait image', type: 'file', bucket: 'media', kind: 'image', folder: 'pantheon' },
      { name: 'verse', label: 'Verse or line (line breaks kept)', type: 'textarea', max: 1200 },
      { name: 'verse_source', label: 'Source / signature work', type: 'text', max: 200 },
      { name: 'translation', label: 'Translation', type: 'textarea', max: 1200 },
      { name: 'iks_context', label: 'Marginalia — IKS context', type: 'textarea', max: 2500, rows: 6 },
      order, published,
    ],
  },


  {
    id: 'result_notices', label: 'Result Notices', icon: '✓', table: 'result_notices', roles: EDIT,
    order: [['published_on', false]],
    list: ['title', 'exam_session', 'published_on', 'published'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 200 },
      { name: 'exam_session', label: 'Examination session', type: 'text', max: 80 },
      { name: 'published_on', label: 'Date', type: 'date' },
      { name: 'link_url', label: 'Link (https://)', type: 'url' },
      { name: 'document_id', label: 'Or attach an uploaded PDF', type: 'select', optionsFrom: { table: 'documents', value: 'id', label: (r) => r.title }, blank: 'None' },
      order, published,
    ],
  },
  {
    id: 'daily_items', label: 'Daily item', icon: '☼', table: 'daily_items', roles: EDIT, nav: false,
    help: 'Keep it literary and neutral: words and their meanings, authors’ birth anniversaries, publication anniversaries, literacy and language days. No politics, religious debate, tragedies or current controversies. Editors save drafts; an administrator approves before anything appears on the website.',
    order: [['show_on', true], ['month_day', true], ['sort_order', true]],
    list: ['kind', 'show_on', 'month_day', 'title', 'status'],
    fields: [
      { name: 'kind', label: 'Type', type: 'select', options: [['word', 'Word of the Day'], ['almanac', 'Today in Literature']], required: true, default: 'word' },
      { name: 'show_on', label: 'Show on this date', type: 'date' },
      { name: 'month_day', label: 'Or repeat every year on (MM-DD, e.g. 05-07) — for anniversaries', type: 'text', pattern: '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$', max: 5 },
      { name: 'is_reserve', label: 'Reserve item (used automatically when a day has nothing scheduled)', type: 'bool', default: false },
      { name: 'title', label: 'Word, or headline', type: 'text', required: true, max: 160 },
      { name: 'meaning', label: 'Meaning, or short description', type: 'textarea', max: 600 },
      { name: 'gujarati', label: 'Gujarati meaning (words)', type: 'text', max: 300 },
      { name: 'hindi', label: 'Hindi meaning (words)', type: 'text', max: 300 },
      { name: 'example', label: 'Example sentence (words)', type: 'textarea', max: 600 },
      { name: 'source', label: 'Source / credit (optional)', type: 'text', max: 200 },
      { name: 'status', label: 'Status (only an administrator can approve)', type: 'select', options: [['draft', 'Draft — waiting for approval'], ['approved', 'Approved — show on the website']], required: true, default: 'draft', adminOnly: true },
      published,
    ],
  },
  {
    id: 'sections', label: 'Pages & Navigation', icon: '☰', table: 'sections', pk: 'slug', roles: EDIT,
    help: 'The folios of the book, in order. Rename, reorder, hide, or add a plain text page.',
    order: [['sort_order', true]],
    list: ['title', 'slug', 'renderer', 'published'],
    fields: [
      { name: 'slug', label: 'Web address (e.g. faculty)', type: 'text', required: true, pattern: '^[a-z0-9-]{2,40}$', max: 40, createOnly: true },
      { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
      { name: 'title_gu', label: 'Title in Gujarati (shown when visitors choose ગુજરાતી)', type: 'text', max: 80 },
      { name: 'kicker', label: 'Small heading above title', type: 'text', max: 60 },
      { name: 'intro', label: 'Introduction', type: 'textarea', max: 1500 },
      { name: 'intro_gu', label: 'Introduction in Gujarati', type: 'textarea', max: 1500 },
      { name: 'renderer', label: 'Page type', type: 'select', options: RENDERERS, required: true, default: 'text' },
      { name: 'body', label: 'Body paragraphs (one per line)', type: 'lines' },
      order, published,
    ],
  },
  {
    id: 'gallery_items', label: 'Events & Gallery', icon: '▣', table: 'gallery_items', roles: EDIT,
    help: 'Photographs grouped by album (one album per event). Photos are resized automatically before upload so they load quickly on slow connections. The tab stays hidden until you publish the “Events & Gallery” page under Pages & Navigation.',
    order: [['event_date', false], ['album', true], ['sort_order', true]],
    list: ['album', 'event_date', 'title', 'published'],
    fields: [
      { name: 'album', label: 'Album / event name', type: 'text', required: true, max: 120 },
      { name: 'event_date', label: 'Event date', type: 'date' },
      { name: 'title', label: 'Photo title (optional)', type: 'text', max: 160 },
      { name: 'caption', label: 'Caption (optional)', type: 'textarea', max: 600, rows: 3 },
      { name: 'image_path', label: 'Photograph (JPG/PNG/WebP, max 5 MB)', type: 'file', bucket: 'media', kind: 'image', folder: 'gallery', required: true },
      order, published,
    ],
  },
  {
    id: 'alumni', label: 'Alumni', icon: '❦', table: 'alumni', roles: EDIT,
    help: 'Short notes from former learners. Add someone only after they have agreed in writing. The tab stays hidden until you publish the “Alumni” page under Pages & Navigation.',
    order: [['sort_order', true], ['name', true]],
    list: ['name', 'batch', 'program_code', 'published'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { name: 'batch', label: 'Batch (e.g. 2019-21)', type: 'text', max: 40 },
      { name: 'program_code', label: 'Programme', type: 'select', optionsFrom: programmeOptions, blank: 'Not specific' },
      { name: 'present_role', label: 'Present role (e.g. Teacher, GSEB school)', type: 'text', max: 200 },
      { name: 'message', label: 'Message (a few lines)', type: 'textarea', max: 600, rows: 4 },
      { name: 'photo_path', label: 'Photograph (optional)', type: 'file', bucket: 'media', kind: 'image', folder: 'alumni' },
      { name: 'consent', label: 'Written consent received to publish name, photo and message', type: 'bool', default: false, mustBeTrue: true },
      order, published,
    ],
  },
  {
    id: 'knowledge_chunks', label: 'Inkwell Knowledge', icon: '✎', table: 'knowledge_chunks', roles: EDIT,
    help: 'Text the Scholar’s Inkwell may quote: syllabus outlines, unit summaries, FAQs. Keep each entry to one topic.',
    order: [['updated_at', false]],
    list: ['title', 'course_code', 'published'],
    fields: [
      { name: 'title', label: 'Topic', type: 'text', required: true, max: 200 },
      { name: 'course_code', label: 'Course code (optional)', type: 'text', max: 30 },
      { name: 'content', label: 'Content', type: 'textarea', required: true, max: 12000, rows: 12 },
      { name: 'published', label: 'Available to the Inkwell', type: 'bool', default: true },
    ],
    noPublish: true,
  },
];

export const SPECIAL = [
  { id: 'daily', label: 'Daily Calendar', icon: '☼', roles: EDIT },
  { id: 'enrolment', label: 'Enrolment (Excel)', icon: '▤', roles: EDIT },
  { id: 'helpdesk', label: 'Helpdesk Tickets', icon: '✉', roles: ['admin', 'helpdesk'] },
  { id: 'settings', label: 'Site Settings', icon: '⚙', roles: EDIT },
  { id: 'staff', label: 'Staff & Roles', icon: '♚', roles: ['admin'] },
  { id: 'audit', label: 'Audit Log', icon: '☷', roles: ['admin'] },
];
