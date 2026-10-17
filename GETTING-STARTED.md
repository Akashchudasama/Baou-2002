# Getting started — a plain-language guide

This guide is for department staff. No programming knowledge is needed for Stages 1 and 3. Stage 2 is easiest with one colleague from BAOU's IT section.

---

## Stage 1 · See the website on your own computer (about 15 minutes)

1. **Install Node.js.** Go to nodejs.org, download the version marked **LTS**, and install it like any other program.
2. **Unzip** `baou-english-portal.zip` somewhere easy, such as your Desktop.
3. **Open a terminal in that folder.**
   - Windows: open the folder, click the address bar at the top, type `cmd` and press Enter.
   - Mac: right-click the folder → *New Terminal at Folder*.
4. Type `npm install` and press Enter. Wait until it finishes (first time only).
5. Type `npm run dev` and press Enter.
6. Open **http://localhost:5173** in Chrome or Edge.

You now see the complete website running on sample content.

**Try the admin console too:** open **http://localhost:5173/admin/**. On your own computer it runs in *practice mode* — no login, and every change is saved only in your browser. Edit something (for example a programme's status line), then refresh the website tab to see it. The yellow banner has *Reset practice data* to start again. Try the Theme button, the page turns, the Pantheon portraits and the Inkwell (bottom right). To stop it, close the terminal window.

Useful address-bar extras while previewing:
- `http://localhost:5173/?fx=saver` — see what a learner on a weak 2G signal sees
- `http://localhost:5173/?fx=lite` — the phone / light version
- `http://localhost:5173/?daylight=night` — the evening lamplight look
- `http://localhost:5173/?nationalday=republic` — preview the Republic Day flag and greeting

---

## Stage 2 · Put it on the internet (one afternoon, free)

You need three free accounts: **Supabase** (database and staff logins), **GitHub** (stores the code), **Cloudflare Pages** (serves the website).

1. **Supabase**
   1. Sign up at supabase.com → *New project* → region **Mumbai**.
   2. Open **SQL Editor**. Paste and run, one after another:
      `supabase/migrations/20261017000000_portal_schema.sql`, then
      `supabase/migrations/20261017100000_phase2_home_messages_themes.sql`, then
      `supabase/migrations/20261017200000_phase3_programmes_slm_research.sql`, then
      `supabase/migrations/20261017300000_phase4_daily_bilingual.sql`, then
      `supabase/migrations/20261017400000_phase5_helpdesk_gallery_alumni.sql`, then
      `supabase/seed.sql`.
   3. **Authentication → Providers → Email:** switch **off** "Allow new users to sign up".
   4. **Authentication → Users → Add user:** your email and a strong password.
   5. Back in **SQL Editor**, run (with your email):
      ```sql
      insert into public.staff (user_id, full_name, email, role)
      select id, 'Dr. Ankit Parmar', email, 'admin' from auth.users where email = 'your-email@example.com';
      ```
   6. **Project Settings → API:** copy the *Project URL* and the *anon / publishable key*.
   7. Ask IT to deploy the four small server functions (README §3.1, step 5). Optional: add a free Gemini key so the Inkwell can write answers.
2. **GitHub:** create a *private* repository and upload the project folder (without `node_modules`).
3. **Cloudflare Pages:** *Create project → Connect to Git* → choose the repository.
   - Build command: `npm run build` · Output folder: `dist`
   - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the two values from step 1.6).
   - Press **Deploy**. You get an address like `baou-english.pages.dev`. IT can later point `english.baou.edu.in` to it.

---

## Stage 3 · Everyday use (no code, ever)

Go to **your-website/admin/** and sign in.

| I want to… | Go to |
|---|---|
| Put up a notice or deadline | Announcements & Ticker → Add new |
| Upload SLM, study material or an assignment | SLM, Study Material & PDFs → Add new → upload the PDF or paste a Google Drive link |
| Update programme details or future scope | Programmes → Edit |
| Plan Word of the Day for the next two weeks | Daily Calendar → Fill empty days from reserve (or Add entry / Upload Excel) → an administrator approves |
| Show the exam countdown | Site Settings → countdown_enabled ✓, countdown_title, countdown_date |
| Upload enrolment figures | Enrolment (Excel) → Download template → fill → Upload |
| Add the top five achievers | Top Achievers → Add new (tick "consent received") |
| Add an exam-form or LMS link | Links → Add new → choose where it shows (LMS address: Site Settings → lms_url) |
| Add or change the Vice Chancellor's message | Leadership Messages → Edit |
| Reply to a learner's query | Helpdesk Tickets → Open → write a public reply → Save |
| Change the website's default colours | Site Settings → default_theme |
| Give a colleague access | Staff & Roles → Invite a colleague |

Every save appears on the public website within about a minute. If something looks wrong, press **Publish now** at the top of the console.
