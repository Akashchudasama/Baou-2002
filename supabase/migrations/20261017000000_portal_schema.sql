-- =====================================================================
--  BAOU Department of English Portal — database schema
--  Target: Supabase (PostgreSQL 15+). Run once on a fresh project.
--  Security model:
--    • Public (anon) can only READ published content.
--    • Staff authenticate with Supabase Auth (JWT). Their role lives in
--      public.staff and is enforced by Row Level Security on every table.
--    • Helpdesk tickets are never writable by anon directly; they arrive
--      through the `helpdesk` Edge Function (validation + rate limiting).
-- =====================================================================

-- ---------- Roles ------------------------------------------------------
create type public.app_role as enum ('admin', 'editor', 'helpdesk');

create table public.staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  email       text not null check (char_length(email) <= 254),
  role        public.app_role not null default 'editor',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function public.has_role(allowed public.app_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.active and s.role = any (allowed)
  );
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(array['admin', 'editor']::public.app_role[]); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(array['admin']::public.app_role[]); $$;

create or replace function public.is_helpdesk()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(array['admin', 'helpdesk']::public.app_role[]); $$;

-- ---------- Generic triggers -------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  actor_email text,
  table_name  text not null,
  action      text not null,
  row_id      text,
  at          timestamptz not null default now()
);

create or replace function public.audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor, actor_email, table_name, action, row_id)
  values (auth.uid(), auth.jwt() ->> 'email', tg_table_name, tg_op,
          coalesce(rec ->> 'id', rec ->> 'key', rec ->> 'slug', rec ->> 'user_id'));
  return coalesce(new, old);
end $$;

-- ---------- Site settings (key/value) ----------------------------------
create table public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  label      text not null default '',
  value      jsonb not null default '""'::jsonb,
  is_public  boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Sections (the folios of the book) ---------------------------
create table public.sections (
  slug       text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  title      text not null check (char_length(title) between 2 and 80),
  kicker     text check (char_length(kicker) <= 60),
  intro      text check (char_length(intro) <= 1500),
  body       text[] not null default '{}',
  renderer   text not null default 'text'
             check (renderer in ('overview','programs','videos','future','faculty',
                                 'demographics','results','helpdesk','text')),
  sort_order int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Content tables ---------------------------------------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 3 and 200),
  body       text check (char_length(body) <= 2000),
  link_url   text check (link_url is null or link_url ~* '^https://[^\s]+$'),
  priority   int not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort_order int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Za-z0-9-]{2,20}$'),
  title       text not null check (char_length(title) between 3 and 160),
  level       text check (char_length(level) <= 80),
  duration    text check (char_length(duration) <= 120),
  medium      text check (char_length(medium) <= 80),
  eligibility text check (char_length(eligibility) <= 600),
  status      text check (char_length(status) <= 60),
  description text check (char_length(description) <= 4000),
  highlights  text[] not null default '{}',
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 200),
  category      text not null check (category in ('syllabus','assignment','sslm','notice','result','other')),
  program_code  text references public.programs (code) on update cascade on delete set null,
  academic_year text check (academic_year is null or academic_year ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  description   text check (char_length(description) <= 600),
  file_path     text not null check (file_path ~ '^[a-z0-9/_.-]{3,300}\.pdf$'),
  file_size     int check (file_size between 1 and 20971520),
  sort_order    int not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.faculty (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 3 and 120),
  designation    text check (char_length(designation) <= 120),
  specialisation text check (char_length(specialisation) <= 300),
  bio            text check (char_length(bio) <= 2000),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_path     text check (photo_path is null or photo_path ~ '^[a-z0-9/_.-]{3,300}$'),
  sort_order     int not null default 0,
  published      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 200),
  course_code text check (char_length(course_code) <= 30),
  unit_label  text check (char_length(unit_label) <= 80),
  speaker     text check (char_length(speaker) <= 120),
  youtube_id  text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  description text check (char_length(description) <= 1500),
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.future_scope (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 3 and 120),
  body       text check (char_length(body) <= 1200),
  pathways   text[] not null default '{}',
  sort_order int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pantheon (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  tradition     text check (char_length(tradition) <= 120),
  era           text check (char_length(era) <= 80),
  portrait_path text check (portrait_path is null or portrait_path ~ '^[a-z0-9/_.-]{3,300}$'),
  verse         text check (char_length(verse) <= 1200),
  verse_source  text check (char_length(verse_source) <= 200),
  translation   text check (char_length(translation) <= 1200),
  iks_context   text check (char_length(iks_context) <= 2500),
  sort_order    int not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.demographics (
  id          uuid primary key default gen_random_uuid(),
  metric_group text not null check (char_length(metric_group) between 2 and 120),
  label       text not null check (char_length(label) between 1 and 120),
  value       numeric not null check (value >= 0),
  unit        text check (char_length(unit) <= 20),
  as_of       text check (char_length(as_of) <= 40),
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.result_notices (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 200),
  exam_session text check (char_length(exam_session) <= 80),
  published_on date,
  link_url     text check (link_url is null or link_url ~* '^https://[^\s]+$'),
  document_id  uuid references public.documents (id) on delete set null,
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Knowledge the Scholar's Inkwell may draw on (syllabus text, FAQs, unit summaries)
create table public.knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 200),
  course_code text check (char_length(course_code) <= 30),
  content     text not null check (char_length(content) between 20 and 12000),
  tsv         tsvector generated always as (
                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(course_code, '') || ' ' || content)
              ) stored,
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index knowledge_chunks_tsv_idx on public.knowledge_chunks using gin (tsv);

-- ---------- Helpdesk ----------------------------------------------------
create table public.helpdesk_tickets (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique default (
                  'ENG' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-' ||
                  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  name          text not null check (char_length(name) between 2 and 80),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  enrolment_no  text check (enrolment_no is null or enrolment_no ~ '^[A-Za-z0-9/-]{4,30}$'),
  program_code  text check (char_length(program_code) <= 20),
  category      text not null check (category in ('admission','assignment','examination','result','study-material','fees','other')),
  subject       text not null check (char_length(subject) between 4 and 140),
  message       text not null check (char_length(message) between 10 and 3000),
  status        text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  public_reply  text check (char_length(public_reply) <= 3000),
  staff_note    text check (char_length(staff_note) <= 3000),
  assigned_to   uuid references public.staff (user_id) on delete set null,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index helpdesk_status_idx on public.helpdesk_tickets (status, created_at desc);
create index helpdesk_email_idx on public.helpdesk_tickets (lower(email));

-- ---------- Rate limiting & AI answer cache (service role only) ---------
create table public.rate_limits (
  bucket       text not null,
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, key, window_start)
);

create or replace function public.hit_rate_limit(p_bucket text, p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, w, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  -- opportunistic housekeeping
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_limit;
end $$;

create table public.inkwell_cache (
  q_hash     text primary key,
  answer     text not null,
  sources    jsonb not null default '[]'::jsonb,
  mode       text not null,
  created_at timestamptz not null default now()
);

-- ---------- Full-text retrieval for the Inkwell -------------------------
create or replace function public.inkwell_search(q text, k int default 6)
returns table (source text, title text, body text, rank real)
language sql stable security definer set search_path = public as $$
  with query as (
    select nullif(replace(websearch_to_tsquery('english', left(q, 500))::text, ' & ', ' | '), '')::tsquery as tsq
  )
  select * from (
    select 'knowledge'::text, kc.title, kc.content, ts_rank_cd(kc.tsv, query.tsq)
    from public.knowledge_chunks kc, query
    where kc.published and query.tsq is not null and kc.tsv @@ query.tsq
    union all
    select 'programme'::text, p.code || ' — ' || p.title,
           concat_ws(E'\n', p.description, 'Level: ' || p.level, 'Duration: ' || p.duration,
                     'Medium: ' || p.medium, 'Eligibility: ' || p.eligibility, 'Status: ' || p.status),
           ts_rank_cd(to_tsvector('english', concat_ws(' ', p.code, p.title, p.description, p.eligibility, p.level)), query.tsq)
    from public.programs p, query
    where p.published and query.tsq is not null
      and to_tsvector('english', concat_ws(' ', p.code, p.title, p.description, p.eligibility, p.level)) @@ query.tsq
    union all
    select 'document'::text, d.title,
           concat_ws(E'\n', 'Category: ' || d.category, 'Programme: ' || d.program_code,
                     'Academic year: ' || d.academic_year, d.description, 'File: ' || d.file_path),
           ts_rank_cd(to_tsvector('english', concat_ws(' ', d.title, d.category, d.program_code, d.description)), query.tsq) * 0.8
    from public.documents d, query
    where d.published and query.tsq is not null
      and to_tsvector('english', concat_ws(' ', d.title, d.category, d.program_code, d.description)) @@ query.tsq
  ) hits
  order by 4 desc
  limit greatest(1, least(k, 10));
$$;

-- ---------- One-call public content bundle ------------------------------
-- Filters are explicit (not RLS-dependent) so the snapshot function can
-- call this with the service role and still publish only public rows.
create or replace function public.public_content()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generated_at', now(),
    'settings', coalesce((select jsonb_object_agg(s.key, s.value) from public.site_settings s where s.is_public), '{}'::jsonb),
    'sections', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.sections x where x.published), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.priority desc, x.sort_order, x.created_at desc)
                          from public.announcements x
                          where x.published and (x.ends_at is null or x.ends_at > now())), '[]'::jsonb),
    'programs', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.programs x where x.published), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(x) - 'updated_at' - 'published' order by x.sort_order, x.created_at desc)
                          from public.documents x where x.published), '[]'::jsonb),
    'faculty', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.name)
                          from public.faculty x where x.published), '[]'::jsonb),
    'videos', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.videos x where x.published), '[]'::jsonb),
    'future_scope', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.title)
                          from public.future_scope x where x.published), '[]'::jsonb),
    'pantheon', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.sort_order, x.name)
                          from public.pantheon x where x.published), '[]'::jsonb),
    'demographics', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.metric_group, x.sort_order, x.label)
                          from public.demographics x where x.published), '[]'::jsonb),
    'result_notices', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.published_on desc nulls last, x.sort_order)
                          from public.result_notices x where x.published), '[]'::jsonb)
  );
$$;

-- =====================================================================
--  Row Level Security
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['sections','announcements','programs','documents','faculty','videos',
                           'future_scope','pantheon','demographics','result_notices','knowledge_chunks'] loop
    execute format('alter table public.%I enable row level security', t);
    if t = 'knowledge_chunks' then
      execute format('create policy "staff read" on public.%I for select to authenticated using (public.is_editor())', t);
    else
      execute format('create policy "public read published" on public.%I for select to anon, authenticated using (published or public.is_editor())', t);
    end if;
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (public.is_editor())', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'trg_' || t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', 'trg_' || t || '_audit', t);
  end loop;
end $$;

-- settings
alter table public.site_settings enable row level security;
create policy "public read public settings" on public.site_settings for select to anon, authenticated
  using (is_public or public.is_editor());
create policy "editors write settings" on public.site_settings for update to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy "admins add settings" on public.site_settings for insert to authenticated with check (public.is_admin());
create policy "admins delete settings" on public.site_settings for delete to authenticated using (public.is_admin());
create trigger trg_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
create trigger trg_settings_audit after insert or update or delete on public.site_settings for each row execute function public.audit();

-- staff
alter table public.staff enable row level security;
create policy "staff see self, admins see all" on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "admins manage staff" on public.staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)) then
    if (select count(*) from public.staff where role = 'admin' and active and user_id <> old.user_id) = 0 then
      raise exception 'At least one active administrator must remain.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_staff_guard before update or delete on public.staff for each row execute function public.guard_last_admin();
create trigger trg_staff_audit after insert or update or delete on public.staff for each row execute function public.audit();

-- helpdesk (no insert policy: tickets only arrive via the Edge Function)
alter table public.helpdesk_tickets enable row level security;
create policy "helpdesk read" on public.helpdesk_tickets for select to authenticated using (public.is_helpdesk());
create policy "helpdesk update" on public.helpdesk_tickets for update to authenticated
  using (public.is_helpdesk()) with check (public.is_helpdesk());
create policy "admins delete tickets" on public.helpdesk_tickets for delete to authenticated using (public.is_admin());
create trigger trg_tickets_touch before update on public.helpdesk_tickets for each row execute function public.touch_updated_at();
create trigger trg_tickets_audit after update or delete on public.helpdesk_tickets for each row execute function public.audit();

-- internal tables: RLS on, no policies => service role only
alter table public.rate_limits   enable row level security;
alter table public.inkwell_cache enable row level security;
alter table public.audit_log     enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated using (public.is_admin());

-- function privileges
revoke all on function public.hit_rate_limit(text, text, int, int) from public, anon, authenticated;
revoke all on function public.inkwell_search(text, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, int, int) to service_role;
grant execute on function public.inkwell_search(text, int) to service_role;
grant execute on function public.public_content() to anon, authenticated, service_role;

-- =====================================================================
--  Storage buckets (public read via CDN, writes restricted)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', true, 20971520, array['application/pdf']),
  ('media',     'media',     true, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('snapshot',  'snapshot',  true, 5242880,  array['application/json'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "editors upload portal files" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents', 'media') and public.is_editor());
create policy "editors update portal files" on storage.objects for update to authenticated
  using (bucket_id in ('documents', 'media') and public.is_editor())
  with check (bucket_id in ('documents', 'media') and public.is_editor());
create policy "editors delete portal files" on storage.objects for delete to authenticated
  using (bucket_id in ('documents', 'media') and public.is_editor());
-- (the `snapshot` bucket is written only by the publish-snapshot function using the service role)
