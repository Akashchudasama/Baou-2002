-- =====================================================================
--  Phase 2: "Home" folio, leadership messages (Vice Chancellor's desk),
--  theme settings. Safe to run on a database that already has phase 1.
-- =====================================================================

-- ---------- Home replaces Overview -------------------------------------
alter table public.sections drop constraint if exists sections_renderer_check;
alter table public.sections add constraint sections_renderer_check
  check (renderer in ('home','overview','programs','videos','future','faculty',
                      'demographics','results','helpdesk','text'));

update public.sections set renderer = 'home' where renderer = 'overview';
update public.sections set slug = 'home', title = 'Home'
  where slug = 'overview' and not exists (select 1 from public.sections where slug = 'home');

-- ---------- Leadership messages ----------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  heading      text not null check (char_length(heading) between 3 and 120),
  author_name  text not null check (char_length(author_name) between 3 and 120),
  designation  text check (char_length(designation) <= 160),
  body         text not null check (char_length(body) between 10 and 6000),
  signature    text check (char_length(signature) <= 120),
  photo_path   text check (photo_path is null or photo_path ~ '^[a-z0-9/_.-]{3,300}$'),
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.messages enable row level security;
drop policy if exists "public read published" on public.messages;
drop policy if exists "editors insert" on public.messages;
drop policy if exists "editors update" on public.messages;
drop policy if exists "editors delete" on public.messages;
create policy "public read published" on public.messages for select to anon, authenticated using (published or public.is_editor());
create policy "editors insert" on public.messages for insert to authenticated with check (public.is_editor());
create policy "editors update" on public.messages for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on public.messages for delete to authenticated using (public.is_editor());
drop trigger if exists trg_messages_touch on public.messages;
drop trigger if exists trg_messages_audit on public.messages;
create trigger trg_messages_touch before update on public.messages for each row execute function public.touch_updated_at();
create trigger trg_messages_audit after insert or update or delete on public.messages for each row execute function public.audit();

-- ---------- Public bundle now includes messages -------------------------
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
grant execute on function public.public_content() to anon, authenticated, service_role;
