# Department of English · BAOU — Portal

Official web portal of the Department of English, School of Humanities and Social Sciences, Dr. Babasaheb Ambedkar Open University, Ahmedabad.

**Parchment & Ink** design in seven colour themes · WebGL gold-ink cursor · 3D page-turn navigation · 3D Home hero lit by the real time of day in Ahmedabad · Vice Chancellor's message · Literary Pantheon with IKS marginalia · *The Scholar's Inkwell* study companion · data-saver mode and offline reading for low-bandwidth areas · zero-code `/admin` console · Supabase (PostgreSQL) backend with Row Level Security.

> New to this? Start with **GETTING-STARTED.md** — a plain-language guide.

Runs at **zero cost** on free tiers: Cloudflare Pages / Netlify / Vercel (static site), Supabase (database, auth, storage, functions), and an optional free Google Gemini key for the Inkwell.

---

## 1. Try it in two minutes (demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Supabase keys set, the portal runs in **practice mode**:

- the website shows the sample content in `public/data/demo-content.json`;
- the **admin console at `/admin/` opens straight away** (no login) and saves every change in your own browser — refresh the website tab to see it;
- uploaded files are not kept in practice mode (use a Google Drive link to try documents); *Reset practice data* in the console's yellow banner starts again.

Adding the two Supabase keys to `.env` switches both the website and the console to the real, secured backend. Nothing else changes.

Add `?fx=full`, `?fx=lite` or `?fx=saver` to the URL to force an experience tier, and `?daylight=dawn|day|dusk|night` to preview the time-of-day lighting.

---

## 2. Architecture

```
                 ┌──────────────── Edge CDN (Cloudflare / Netlify / Vercel) ───────────────┐
 learners ─────► │  index.html + hashed JS/CSS/fonts (immutable, cached for a year)         │
                 └──────────────────────────────────────────────────────────────────────────┘
        │  one request per visit, cached 60 s at Supabase's CDN
        ▼
 Supabase Storage  snapshot/content.json  ◄── written by publish-snapshot after every staff save
 Supabase Storage  documents/*.pdf, media/*  (public, CDN-cached)
        │
        ▼ only these touch the database
 Edge Functions:  helpdesk (submit / status)   inkwell (search + optional Gemini)
                  publish-snapshot (staff)      staff-admin (invite colleagues)
        │
 PostgreSQL + Row Level Security  ◄── /admin console (Supabase Auth JWT, role-checked)
```

Why it survives admission and result-day spikes: public pages never query the database. A visitor downloads the static site from the edge plus **one** cached JSON file. Thousands of learners at once cost the database nothing; only helpdesk submissions and Inkwell questions reach it, and both are rate-limited per connection. If the snapshot is ever missing, the site falls back to a single `public_content()` RPC; returning visitors are served from their session cache first.

### Home page features

- **Word of the Day** (with Gujarati and Hindi meanings) and **Today in Literature** (anniversaries that repeat every year), planned in *Admin › Daily Calendar*. The calendar shows the next 14 days, warns when any are empty, fills empty days from the reserve pool in one click, and accepts an Excel/CSV upload. **Two-person rule:** editors save drafts; only an administrator can approve, and the database enforces this. Days with nothing approved use the approved reserve pool, so the Home page is never blank.
- **Exam countdown ribbon** — *Site Settings*: countdown_enabled, countdown_title, countdown_date.
- **"Which programme suits me?"** — a three-question quiz (editable in *Site Settings › programme_quiz*) that opens the suggested book on the programme shelf.
- **Reading tools (Aa):** larger text, and *Listen to this page* using the phone's own voice.
- **English / ગુજરાતી switch:** the interface (menus, buttons, labels) and folio titles switch to Gujarati; course content stays in English. Gujarati folio titles are edited in *Pages & Navigation*. Translations in `src/lib/i18n.js` should be reviewed by the department.
- **Tiranga:** a slim saffron-white-green ribbon with the Ashoka Chakra under the masthead every day; on 26 January and 15 August (India time) a waving flag and greeting appear on Home. Preview with `?nationalday=republic` or `?nationalday=independence`.
- **Ask the Muse:** the inkwell companion, labelled on the bottle.

### Three experience tiers (chosen automatically, changeable in the footer)

| Tier | Who gets it | What it does | First visit |
|---|---|---|---|
| **Rich 3D** | capable laptops/desktops on good connections | gold-ink cursor, 3D page turns, 3D Home hero with time-of-day lighting | ≈ 0.5 MB (Three.js loads after the page is usable) |
| **Light** | phones, low-memory devices, 3G, reduced-motion | smooth 2D page transitions, vector book illustration, web fonts | ≈ 340 KB |
| **Data saver** | 2G, Data Saver switched on, very slow links (remote and border districts) | system fonts (no font downloads), no motion, no video thumbnails until tapped | ≈ 130 KB |

**Offline reading (all tiers):** a service worker keeps the site and the department's content on the device after the first visit. When the signal drops, learners still see every folio they opened, with a notice that they are offline. *Save offline* next to each PDF downloads it to the phone for reading without a connection. The service worker never caches `/admin`, logins or form submissions.

**Time of day (the fourth dimension):** the paper tint, the Inkwell lamp and the 3D hero's lighting follow India Standard Time in Ahmedabad — dawn, daylight, evening light and lamplight — whatever the visitor's own clock says.

**Colour themes (12):** Parchment & Ink, Peacock & Saffron, Indigo Manuscript, Kesar & Sandalwood, Neem & Ivory, Lotus & Bronze, Monsoon Slate, and five inspired by Gujarat — Patola, Ajrakh, Rann, Sabarmati and Bandhani. Same design, typography and layout; only the palette changes, and all are light themes. Visitors choose from the **Theme** button (remembered on their device); the department sets the default and which themes are offered in *Admin › Site Settings*.

---

## 3. Go live — step by step

### 3.1 Supabase (free)
1. Create a project at supabase.com (region: Mumbai `ap-south-1`).
2. **SQL Editor → run, in this order:** `supabase/migrations/20261017000000_portal_schema.sql`, `supabase/migrations/20261017100000_phase2_home_messages_themes.sql`, `supabase/migrations/20261017200000_phase3_programmes_slm_research.sql`, `supabase/migrations/20261017300000_phase4_daily_bilingual.sql`, `supabase/migrations/20261017400000_phase5_helpdesk_gallery_alumni.sql`, then `supabase/seed.sql`.
   *(Already ran earlier files? Run only the newer migration files, then the seed again.)*
   *(Or with the CLI: `supabase link` then `supabase db push` and run the seed.)*
3. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up". Staff join by invitation only.
   **Authentication → URL configuration:** set Site URL to your domain and add `https://YOUR-DOMAIN/admin/` to Redirect URLs.
4. **Create the first administrator**
   - Authentication → Users → *Add user* (email + strong password).
   - SQL Editor:
     ```sql
     insert into public.staff (user_id, full_name, email, role)
     select id, 'Dr. Ankit Parmar', email, 'admin' from auth.users where email = 'you@baou.edu.in';
     ```
5. **Edge Functions** (Supabase CLI):
   ```bash
   supabase functions deploy helpdesk inkwell publish-snapshot staff-admin
   supabase secrets set ALLOWED_ORIGINS="https://english.baou.edu.in,https://baou-english.pages.dev" \
                        SITE_URL="https://english.baou.edu.in" \
                        IP_HASH_SALT="$(openssl rand -hex 24)"
   # optional, free: https://aistudio.google.com/apikey
   supabase secrets set GEMINI_API_KEY="..." GEMINI_MODEL="gemini-2.5-flash"
   # optional, free bot protection: Cloudflare Turnstile secret
   supabase secrets set TURNSTILE_SECRET="..."
   ```
   `supabase/config.toml` already sets `verify_jwt = false` for these functions: each one validates its own requests (staff functions verify the JWT with Supabase Auth and check the role).

### 3.2 Frontend (free static hosting)
Set these environment variables in the host's dashboard (see `.env.example`):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon / publishable key (public by design; RLS protects data) |
| `VITE_TURNSTILE_SITE_KEY` | optional |

- **Cloudflare Pages:** build command `npm run build`, output `dist`. `public/_headers` and `_redirects` are applied automatically.
- **Netlify:** `netlify.toml` is included.
- **Vercel:** `vercel.json` is included.

HTTPS is automatic on all three, and HSTS is sent by the headers files.

### 3.3 First publish
Sign in at `/admin/` and press **Publish now**. From then on, every save republishes automatically within a few seconds, and visitors see it within about a minute.

---

## 4. For department staff — the admin console

Open `https://YOUR-DOMAIN/admin/` and sign in. No code, ever.

| Section | What you can do |
|---|---|
| Dashboard | Counts of open tickets, notices, PDFs and videos at a glance. |
| Programmes | The books on the Programme shelf: details, shelf (B.A., M.A., Diploma, Certificate, PhD), highlights and *Where it can lead* (future scope). |
| Programme Courses | The *What you'll study* page, semester by semester. |
| Enrolment (Excel) | Download the template, fill it in Excel, upload it. Male, female and transgender learners per programme, year and semester; charts update automatically. |
| SLM, Study Material & PDFs | Upload a PDF or paste a Google Drive link. Choose SLM, study material, assignment, syllabus or booklet; add programme, semester and course code so learners can filter. |
| Top Achievers | Top five per programme and year. A "written consent received" tick is required — the database refuses an entry without it. |
| Links | Exam form, assignment portal, results, university website, social media — choose where each appears (programme books, SLM tab, Results, footer…). |
| Daily Calendar | Word of the Day and Today in Literature for at least the next 14 days; reserve pool; Excel upload; approval by an administrator. |
| Leadership Messages | The Vice Chancellor's message on the Home page: heading, name, designation, message, signature and photograph. Add more messages (e.g. Head of Department) the same way. |
| Announcements & Ticker | Add headlines with optional link, priority and start/end dates. They scroll in the ticker and fill the Notice Board. |
| PDFs: Syllabi & Assignments | Upload PDF (max 20 MB), choose category and programme. Appears under that programme and in the Library. |
| Programmes | Codes, titles, eligibility, duration, highlights. Uncheck *Show on website* to keep a draft hidden. |
| Faculty Profiles | Qualifications, specialisation, research areas, publications, books, SLMs written, awards, photo. Tick *PhD research guide* and enter PhDs completed to show the person on the PhD & Research tab. |
| Literary Pantheon | Portraits (shown sepia), verse, translation and IKS marginalia. |
| Result Notices | Result announcements and links. |
| Pages & Navigation | Rename, reorder or hide sections, or add a plain text page. |
| Inkwell Knowledge | Paste syllabus outlines, unit summaries and FAQs the Inkwell may draw on. |
| Helpdesk Tickets | Filter, reply publicly (learner sees it with their reference), keep internal notes, assign, mark resolved. Each ticket shows the learner's enrolment number, registered email and mobile number (tap to call). The Helpdesk tab shows only the overall *% resolved* ring — never ticket details. |
| Events & Gallery | Photo albums, one per event. Photos are shrunk in the browser (max 1600 px) before upload so pages stay light on slow connections. **Hidden until you publish the "Events & Gallery" page** under *Pages & Navigation*. |
| Alumni | Short notes from former learners with an optional photo; a "written consent received" tick is required. **Hidden until you publish the "Alumni" page** under *Pages & Navigation*. |
| Site Settings | Names, hero text, overview, contact details, Inkwell greeting and instructions, default colour theme and the themes visitors may choose. |
| Staff & Roles *(admin)* | Invite colleagues by email; set role; deactivate. |
| Audit Log *(admin)* | Who changed what, when. |

**Roles:** *Administrator* — everything · *Editor* — content and settings · *Helpdesk* — tickets only.

---

## 5. Security

| Control | Where |
|---|---|
| JWT authentication (Supabase Auth), auto-refresh, session in `sessionStorage`, 30-minute idle sign-out | `src/admin/main.js` |
| Role-based access enforced **in the database** by Row Level Security on every table and storage bucket; the UI hides what RLS would refuse anyway | migration, *Row Level Security* section |
| Last active administrator cannot be demoted or removed | `guard_last_admin` trigger |
| Invitation-only accounts, 12+ character passwords with mixed classes | `config.toml`, dashboard |
| Helpdesk: server-side validation, tag/control-character stripping, honeypot, per-connection rate limits, optional Turnstile; tickets cannot be inserted directly by the public | `functions/helpdesk`, `_shared/sanitize.ts` |
| Helpdesk personal data: enrolment number, mobile number and consent are mandatory (checked in the browser, the Edge Function and a database trigger). Six months after a ticket is resolved or closed, name, email, mobile, enrolment number and message are removed automatically (`purge_helpdesk_personal_data`), keeping only subject, category and status for the statistics | `functions/helpdesk`, phase 5 migration |
| Status lookup needs reference **and** email; identical response for "not found" and "wrong email" | `functions/helpdesk` |
| XSS: all dynamic text rendered through `textContent`; `innerHTML` is never used with data; URLs pass an allow-list (`https:`, `mailto:`, `tel:`) | `src/lib/dom.js` |
| Strict CSP (no inline scripts or styles, no `eval`), HSTS preload, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy | `public/_headers`, `vercel.json` |
| Upload checks: file signature (magic bytes), size and type in the browser; bucket MIME/size limits on the server | admin + migration |
| Raw IP addresses never stored (salted SHA-256) | `_shared/http.ts` |
| Audit trail of every content, staff and ticket change | `audit_log` |

Before launch, replace `https://*.supabase.co` in the CSP with your exact project host.

---

## 6. The Scholar's Inkwell

Answers are grounded in the department's own material. Full-text search runs across *Inkwell Knowledge*, programmes and document titles; the matching passages are given to a **free** Gemini model with instructions to use only that context for university facts and to point to the Helpdesk when unsure.

- No `GEMINI_API_KEY`, quota exhausted, or AI down → the Inkwell still answers in **library mode**, quoting the most relevant passages. It never goes dark.
- Popular first questions are cached for 6 hours to save free-tier quota on busy days.
- Edit the persona and rules in *Site Settings → Inkwell instructions (private)*.

---

## 7. Content you must verify before launch

`seed/seed-data.json` holds starter content. Check it with the department, then edit it live in `/admin`:

- **Vice Chancellor's message** is a placeholder explaining where the message goes. Replace it with the approved text and photograph in *Leadership Messages*.
- **Demographics** are marked *(illustrative)*: replace them with verified figures.
- Faculty specialisations and bios are blank except where known; add them.
- Programme codes, eligibility wording, status lines, video titles and contact details are placeholders to confirm against official notifications.
- Pantheon verses are public-domain texts or translations written for this portal. Only upload portraits that are public-domain or licensed.

To change the seed itself: edit `seed/seed-data.json`, run `npm run seed`, and both `supabase/seed.sql` and the demo data are regenerated.

---

## 8. Operational notes

- **Free Supabase projects pause after about a week with no activity.** Normal learner traffic keeps a live portal active; for guaranteed uptime the university may later move to a paid plan. No code changes are needed.
- Indicative free-tier ceilings: 500,000 Edge Function calls a month (helpdesk and Inkwell only), 1 GB file storage (≈ 100 assignment booklets at 10 MB), 5 GB egress. Snapshot and PDF downloads are CDN-cached.
- Helpdesk clean-up runs on its own from the Edge Function. For a fixed daily run, enable the `pg_cron` extension and run the one-line `cron.schedule(...)` shown in the phase 5 migration.
- Before publishing Events & Gallery or Alumni, get written permission from people shown in photographs and from each alumnus; the Alumni form will not save without the consent tick.
- Back up regularly from the Supabase dashboard (Database → Backups) or with `supabase db dump`.

---

## 9. Project map

```
index.html              portal shell
admin/index.html        admin console shell
src/main.js             boot, routing, ticker, footer
src/config.js           environment and URLs
src/lib/                content data layer, safe DOM builder, device tiering
src/fx/inkCanvas.js     Three.js gold-ink particle engine (lazy)
src/fx/pageTurn.js      3D page turn: curl strips, spring physics, lighting
src/fx/heroBook.js      3D Home hero: procedural book, self-turning pages, IST lighting
src/lib/themes.js       theme catalogue (palettes live in src/styles/themes.css)
src/lib/daylight.js     India Standard Time → dawn / day / dusk / night
public/sw.js            offline service worker; public/offline.html fallback page
public/boot.js          applies the saved theme before first paint
src/components/         section renderers, pantheon, inkwell, helpdesk, medallion
src/admin/              console (schema-driven forms) and module definitions
src/styles/             base tokens, portal, admin
supabase/migrations/    schema, RLS, functions, storage buckets
supabase/functions/     helpdesk, inkwell, publish-snapshot, staff-admin
supabase/seed.sql       generated starter content
seed/seed-data.json     single source for the seed + demo data
scripts/build-seed.mjs  regenerates seed.sql and demo-content.json
public/_headers         CSP, HSTS and caching (Netlify / Cloudflare Pages)
vercel.json, netlify.toml
```
"# Baou-2002" 
"# Baou-2002" 
"# Baou-2002" 
