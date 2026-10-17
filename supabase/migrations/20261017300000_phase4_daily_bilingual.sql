-- =====================================================================
--  Phase 4: daily literary items (Word of the Day, Today in Literature)
--  with two-person approval, and Gujarati titles for the folios.
-- =====================================================================

alter table public.sections
  add column if not exists title_gu text check (char_length(title_gu) <= 80),
  add column if not exists intro_gu text check (char_length(intro_gu) <= 1500);

create table if not exists public.daily_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('word', 'almanac')),
  show_on     date,                                   -- a specific day (words), or null
  month_day   text check (month_day is null or month_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'), -- recurring every year (almanac)
  is_reserve  boolean not null default false,         -- used automatically when a day has nothing scheduled
  title       text not null check (char_length(title) between 2 and 160),   -- the word, or the almanac headline
  meaning     text check (char_length(meaning) <= 600),
  gujarati    text check (char_length(gujarati) <= 300),
  hindi       text check (char_length(hindi) <= 300),
  example     text check (char_length(example) <= 600),
  source      text check (char_length(source) <= 200),
  status      text not null default 'draft' check (status in ('draft', 'approved')),
  created_by  uuid,
  approved_by uuid,
  approved_at timestamptz,
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (show_on is not null or month_day is not null or is_reserve)
);
create unique index if not exists daily_items_one_per_day on public.daily_items (kind, show_on) where show_on is not null;
create index if not exists daily_items_month_day on public.daily_items (kind, month_day);

-- Two-person rule: editors create and edit drafts; only an administrator can
-- approve. Any edit by a non-administrator sends an item back to draft.
-- (Direct SQL / service-role writes, which have no signed-in user, are trusted.)
create or replace function public.daily_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if public.is_admin() then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
  else
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_daily_guard on public.daily_items;
create trigger trg_daily_guard before insert or update on public.daily_items for each row execute function public.daily_items_guard();

alter table public.daily_items enable row level security;
drop policy if exists "public read approved" on public.daily_items;
drop policy if exists "editors insert" on public.daily_items;
drop policy if exists "editors update" on public.daily_items;
drop policy if exists "editors delete" on public.daily_items;
create policy "public read approved" on public.daily_items for select to anon, authenticated
  using ((published and status = 'approved') or public.is_editor());
create policy "editors insert" on public.daily_items for insert to authenticated with check (public.is_editor());
create policy "editors update" on public.daily_items for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on public.daily_items for delete to authenticated using (public.is_editor());
drop trigger if exists trg_daily_items_touch on public.daily_items;
drop trigger if exists trg_daily_items_audit on public.daily_items;
create trigger trg_daily_items_touch before update on public.daily_items for each row execute function public.touch_updated_at();
create trigger trg_daily_items_audit after insert or update or delete on public.daily_items for each row execute function public.audit();

-- ---------- Public bundle: adds approved daily items -------------------------
-- Dated items from yesterday to 20 days ahead, every recurring almanac entry,
-- and the reserve pool — so the snapshot keeps the Home page fresh for weeks
-- even if nobody publishes in between.
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
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
                          'id', x.id, 'kind', x.kind, 'show_on', x.show_on, 'month_day', x.month_day, 'is_reserve', x.is_reserve,
                          'title', x.title, 'meaning', x.meaning, 'gujarati', x.gujarati, 'hindi', x.hindi,
                          'example', x.example, 'source', x.source, 'sort_order', x.sort_order) order by x.kind, x.sort_order, x.title)
                          from public.daily_items x
                          where x.published and x.status = 'approved'
                            and (x.is_reserve or x.month_day is not null
                                 or x.show_on between (now() at time zone 'Asia/Kolkata')::date - 1
                                                  and (now() at time zone 'Asia/Kolkata')::date + 20)), '[]'::jsonb),
    'helpdesk_stats', public.helpdesk_stats()
  );
$$;
grant execute on function public.public_content() to anon, authenticated, service_role;
