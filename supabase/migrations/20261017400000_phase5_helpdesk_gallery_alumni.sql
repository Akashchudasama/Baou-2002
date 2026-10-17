-- =====================================================================
--  Phase 5: helpdesk (mandatory enrolment number + phone, consent,
--  automatic removal of personal data), Events & Gallery, Alumni.
-- =====================================================================

-- ---------- Helpdesk -------------------------------------------------------
alter table public.helpdesk_tickets
  add column if not exists phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  add column if not exists consent_at timestamptz,
  add column if not exists redacted_at timestamptz;

-- New tickets must carry enrolment number, phone and consent (older rows,
-- and later status updates, are not affected).
alter table public.helpdesk_tickets drop constraint if exists helpdesk_required_fields;
create or replace function public.helpdesk_require_fields()
returns trigger language plpgsql as $$
begin
  if new.enrolment_no is null or new.phone is null or new.consent_at is null then
    raise exception 'Enrolment number, phone number and consent are required.';
  end if;
  return new;
end $$;
drop trigger if exists trg_tickets_required on public.helpdesk_tickets;
create trigger trg_tickets_required before insert on public.helpdesk_tickets for each row execute function public.helpdesk_require_fields();

-- Personal details are kept only as long as needed: some months after a
-- ticket is resolved or closed, the learner's name, email and phone are
-- removed. The subject, category and status stay for the statistics.
create or replace function public.purge_helpdesk_personal_data(months int default 6)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.helpdesk_tickets
     set name = 'Removed', email = 'removed+' || lower(reference) || '@invalid.local',
         phone = null, enrolment_no = null, message = '[removed after closure]', redacted_at = now()
   where redacted_at is null
     and status in ('resolved', 'closed')
     and updated_at < now() - make_interval(months => months);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_helpdesk_personal_data(int) from public, anon, authenticated;
grant execute on function public.purge_helpdesk_personal_data(int) to service_role;
-- Optional: if the pg_cron extension is enabled in Supabase (Database → Extensions),
-- run this once to purge daily at 02:30 IST:
--   select cron.schedule('purge-helpdesk', '0 21 * * *', $$select public.purge_helpdesk_personal_data(6)$$);
-- (The helpdesk Edge Function also runs it occasionally, so it works without pg_cron.)

-- ---------- Events & Gallery -------------------------------------------------
create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  album       text not null check (char_length(album) between 2 and 120),
  event_date  date,
  title       text check (char_length(title) <= 160),
  caption     text check (char_length(caption) <= 600),
  image_path  text not null check (image_path ~ '^[a-z0-9/_.-]{3,300}$'),
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Alumni (published only with consent) -----------------------------
create table if not exists public.alumni (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 120),
  batch        text check (char_length(batch) <= 40),
  program_code text references public.programs (code) on update cascade on delete set null,
  present_role text check (char_length(present_role) <= 200),
  message      text check (char_length(message) <= 600),
  photo_path   text check (photo_path is null or photo_path ~ '^[a-z0-9/_.-]{3,300}$'),
  consent      boolean not null default false check (consent),
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['gallery_items','alumni'] loop
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

-- ---------- Public bundle: adds gallery and alumni --------------------------------
-- Rebuilt by wrapping the phase-4 bundle, so earlier keys stay identical.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'public_content_v4' and pronamespace = 'public'::regnamespace) then
    alter function public.public_content() rename to public_content_v4;
  end if;
end $$;
grant execute on function public.public_content_v4() to anon, authenticated, service_role;

create or replace function public.public_content()
returns jsonb language sql stable security invoker set search_path = public as $$
  select public.public_content_v4() || jsonb_build_object(
    'gallery', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' order by x.event_date desc nulls last, x.album, x.sort_order)
                         from public.gallery_items x where x.published), '[]'::jsonb),
    'alumni', coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' - 'updated_at' - 'published' - 'consent' order by x.sort_order, x.name)
                         from public.alumni x where x.published and x.consent), '[]'::jsonb)
  );
$$;
grant execute on function public.public_content() to anon, authenticated, service_role;
