create extension if not exists "pgcrypto";

create type public.competition_status as enum ('draft', 'live', 'complete');
create type public.score_type as enum ('for-time', 'amrap', 'max-load');
create type public.score_status as enum ('scored', 'capped', 'dns');
create type public.heat_status as enum ('ready', 'complete');

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text not null default '',
  status public.competition_status not null default 'draft',
  public_slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.staff_members (
  competition_id uuid not null references public.competitions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (competition_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table public.wods (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions on delete cascade,
  name text not null,
  description text not null default '',
  score_type public.score_type not null,
  cap_seconds integer,
  sort_order integer not null default 0
);

create table public.position_points (
  competition_id uuid not null references public.competitions on delete cascade,
  position integer not null check (position > 0),
  points integer not null check (points >= 0),
  primary key (competition_id, position)
);

create table public.heats (
  id uuid primary key default gen_random_uuid(),
  wod_id uuid not null references public.wods on delete cascade,
  heat_number integer not null check (heat_number > 0),
  status public.heat_status not null default 'ready',
  unique (wod_id, heat_number)
);

create table public.heat_lanes (
  heat_id uuid not null references public.heats on delete cascade,
  lane_number integer not null check (lane_number between 1 and 4),
  team_id uuid references public.teams on delete set null,
  primary key (heat_id, lane_number),
  unique (heat_id, team_id)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  wod_id uuid not null references public.wods on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  status public.score_status not null default 'scored',
  value numeric not null default 0,
  tie_break numeric,
  penalty numeric not null default 0,
  submitted_by uuid references auth.users,
  submitted_at timestamptz not null default now(),
  unique (wod_id, team_id)
);

create table public.score_audit_log (
  id bigint generated always as identity primary key,
  score_id uuid not null references public.scores on delete cascade,
  changed_by uuid references auth.users,
  previous_value jsonb,
  next_value jsonb not null,
  changed_at timestamptz not null default now()
);

create or replace function public.is_competition_staff(target_competition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members
    where competition_id = target_competition and user_id = auth.uid()
  );
$$;

alter table public.competitions enable row level security;
alter table public.staff_members enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.wods enable row level security;
alter table public.position_points enable row level security;
alter table public.heats enable row level security;
alter table public.heat_lanes enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit_log enable row level security;

create policy "public competitions are readable" on public.competitions for select using (status in ('live', 'complete') or public.is_competition_staff(id));
create policy "public teams are readable" on public.teams for select using (exists (select 1 from public.competitions c where c.id = competition_id and c.status in ('live', 'complete')) or public.is_competition_staff(competition_id));
create policy "public participants are readable" on public.participants for select using (exists (select 1 from public.teams t join public.competitions c on c.id = t.competition_id where t.id = team_id and c.status in ('live', 'complete')));
create policy "public wods are readable" on public.wods for select using (exists (select 1 from public.competitions c where c.id = competition_id and c.status in ('live', 'complete')) or public.is_competition_staff(competition_id));
create policy "public points are readable" on public.position_points for select using (exists (select 1 from public.competitions c where c.id = competition_id and c.status in ('live', 'complete')));
create policy "public scores are readable" on public.scores for select using (exists (select 1 from public.wods w join public.competitions c on c.id = w.competition_id where w.id = wod_id and c.status in ('live', 'complete')));

create policy "staff manage teams" on public.teams for all using (public.is_competition_staff(competition_id)) with check (public.is_competition_staff(competition_id));
create policy "staff manage wods" on public.wods for all using (public.is_competition_staff(competition_id)) with check (public.is_competition_staff(competition_id));
create policy "staff manage points" on public.position_points for all using (public.is_competition_staff(competition_id)) with check (public.is_competition_staff(competition_id));
create policy "staff manage competitions" on public.competitions for update using (public.is_competition_staff(id)) with check (public.is_competition_staff(id));
create policy "staff manage participants" on public.participants for all using (exists (select 1 from public.teams t where t.id = team_id and public.is_competition_staff(t.competition_id))) with check (exists (select 1 from public.teams t where t.id = team_id and public.is_competition_staff(t.competition_id)));
create policy "staff manage heats" on public.heats for all using (exists (select 1 from public.wods w where w.id = wod_id and public.is_competition_staff(w.competition_id))) with check (exists (select 1 from public.wods w where w.id = wod_id and public.is_competition_staff(w.competition_id)));
create policy "staff manage lanes" on public.heat_lanes for all using (exists (select 1 from public.heats h join public.wods w on w.id = h.wod_id where h.id = heat_id and public.is_competition_staff(w.competition_id))) with check (exists (select 1 from public.heats h join public.wods w on w.id = h.wod_id where h.id = heat_id and public.is_competition_staff(w.competition_id)));
create policy "staff manage scores" on public.scores for all using (exists (select 1 from public.wods w where w.id = wod_id and public.is_competition_staff(w.competition_id))) with check (exists (select 1 from public.wods w where w.id = wod_id and public.is_competition_staff(w.competition_id)));

alter publication supabase_realtime add table public.scores;
