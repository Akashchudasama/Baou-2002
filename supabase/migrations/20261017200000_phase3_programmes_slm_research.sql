-- =====================================================================
--  Phase 3: programme shelf (levels, courses, future scope, enrolment),
--  SLM & study material (Drive links, semesters, assignments, booklets),
--  faculty profiles & PhD guides, toppers, managed links.
-- =====================================================================

-- ---------- Sections: new page types ------------------------------------
alter table public.sections drop constraint if exists sections_renderer_check;
alter table public.sections add constraint sections_renderer_check
  check (renderer in ('home','overview','programs','slm','faculty','research','results',
                      'helpdesk','gallery','alumni','videos','future','demographics','text'));

-- retired folios (their content moved into Programmes) are hidden, not deleted
update public.sections set published = false
  where slug in ('sslm-videos', 'future-scope', 'demographics') or renderer in ('videos', 'future', 'demographics');

-- ---------- Programmes ---------------------------------------------------
alter table public.programs
  add column if not exists level_group  text not null default 'ma'
      check (level_group in ('ba','ma','diploma','certificate','phd')),
  add column if not exists future_scope text[] not null default '{}',
  add column if not exists fees_note    text check (char_length(fees_note) <= 300);

create table if not exists public.program_courses (
  id           uuid primary key default gen_random_uuid(),
  program_code text not null references public.programs (code) on update cascade on delete cascade,
  semester     int  not null check (semester between 1 and 10),
  course_code  text check (char_length(course_code) <= 30),
  title        text not null check (char_length(title) between 2 and 200),
  credits      numeric check (credits is null or credits between 0 and 40),
  course_type  text check (char_length(course_type) <= 60),
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.enrolments (
  id            uuid primary key default gen_random_uuid(),
  program_code  text not null references public.programs (code) on update cascade on delete cascade,
  academic_year text not null check (academic_year ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  semester      int  not null check (semester between 1 and 10),
  male          int  not null default 0 check (male >= 0),
  female        int  not null default 0 check (female >= 0),
  transgender   int  not null default 0 check (transgender >= 0),
  sort_order    int  not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (program_code, academic_year, semester)
);

-- ---------- Documents: Drive links, semesters, booklet covers -----------
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (category in ('slm','study-material','assignment','syllabus','booklet','notice','result','sslm','other'));
update public.documents set category = 'slm' where category = 'sslm';
alter table public.documents alter column file_path drop not null;
alter table public.documents
  add column if not exists external_url text check (external_url is null or external_url ~* '^https://[^\s]+$'),
  add column if not exists semester     int  check (semester is null or semester between 1 and 10),
  add column if not exists course_code  text check (char_length(course_code) <= 30),
  add column if not exists cover_path   text check (cover_path is null or cover_path ~ '^[a-z0-9/_.-]{3,300}$');
alter table public.documents drop constraint if exists documents_source_check;
alter table public.documents add constraint documents_source_check
  check (file_path is not null or external_url is not null);

-- ---------- Faculty profiles & PhD guides --------------------------------
alter table public.faculty
  add column if not exists qualifications text check (char_length(qualifications) <= 600),
  add column if not exists research_areas text check (char_length(research_areas) <= 400),
  add column if not exists publications   text[] not null default '{}',
  add column if not exists books          text[] not null default '{}',
  add column if not exists slms_written   text[] not null default '{}',
  add column if not exists awards         text[] not null default '{}',
  add column if not exists is_phd_guide   boolean not null default false,
  add column if not exists phd_completed  int not null default 0 check (phd_completed >= 0);

-- ---------- Toppers (published only with the learner's consent) ---------
create table if not exists public.toppers (
  id            uuid primary key default gen_random_uuid(),
  program_code  text not null references public.programs (code) on update cascade on delete cascade,
  academic_year text not null check (academic_year ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  rank          int  not null check (rank between 1 and 5),
  student_name  text not null check (char_length(student_name) between 2 and 120),
  percentage    numeric(5,2) not null check (percentage between 0 and 100),
  consent       boolean not null default false check (consent),
  sort_order    int not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (program_code, academic_year, rank)
);

-- ---------- Managed links ---------------------------------------------------
create table if not exists public.links (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (char_length(label) between 2 and 80),
  url          text not null check (url ~* '^https://[^\s]+$'),
  placement    text not null check (placement in ('footer','social','home','programme','slm','results','helpdesk','research')),
  program_code text references public.programs (code) on update cascade on delete cascade,
  kind         text check (char_length(kind) <= 30),
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- RLS, triggers for new tables -----------------------------------
do $$
declare t text;
begin
  foreach t in array array['program_courses','enrolments','toppers','links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read published" on public.%I', t);
    execute format('drop policy if exists "editors insert" on public.%I', t);
    execute format('drop policy if exists "editors update" on public.%I', t);
    execute format('drop policy if exists "editors delete" on public.%I', t);
    execute format('create policy "public read published" on public.%I for select to anon, authenticated using (published or public.is_editor())', t);
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (public.is_editor())', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_touch', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_audit', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'trg_' || t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', 'trg_' || t || '_audit', t);
  end loop;
end $$;

-- ---------- Helpdesk totals (counts only, never ticket contents) -----------
create or replace function public.helpdesk_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total', count(*),
                            'resolved', count(*) filter (where status in ('resolved','closed')))
  from public.helpdesk_tickets;
$$;
grant execute on function public.helpdesk_stats() to anon, authenticated, service_role;

-- ---------- Public bundle ----------------------------------------------------
create or replace function public.public_content()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generated_at', now(),
    'settings', coalesce((select jsonb_object_agg(s.key, s.value) from public.site_settings s where s.is_public), '{}'::jsonb),
    'sections', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.sections x where x.published), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.created_at)
                          from public.messages x where x.published), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.priority desc, x.sort_order, x.created_at desc)
                          from public.announcements x
                          where x.published and (x.ends_at is null or x.ends_at > now())), '[]'::jsonb),
    'programs', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.programs x where x.published), '[]'::jsonb),
    'program_courses', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.program_code, x.semester, x.sort_order, x.course_code)
                          from public.program_courses x where x.published), '[]'::jsonb),
    'enrolments', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.program_code, x.academic_year desc, x.semester)
                          from public.enrolments x where x.published), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(x) - 'updated_at' - 'published' order by x.sort_order, x.created_at desc)
                          from public.documents x where x.published), '[]'::jsonb),
    'faculty', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.name)
                          from public.faculty x where x.published), '[]'::jsonb),
    'pantheon', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.name)
                          from public.pantheon x where x.published), '[]'::jsonb),
    'toppers', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' - 'consent' order by x.academic_year desc, x.program_code, x.rank)
                          from public.toppers x where x.published and x.consent), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.placement, x.sort_order, x.label)
                          from public.links x where x.published), '[]'::jsonb),
    'result_notices', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.published_on desc nulls last, x.sort_order)
                          from public.result_notices x where x.published), '[]'::jsonb),
    'helpdesk_stats', public.helpdesk_stats()
  );
$$;
grant execute on function public.public_content() to anon, authenticated, service_role;
