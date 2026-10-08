-- Every authenticated staff account shares the same competition workspace.
create or replace function public.is_competition_staff(target_competition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null;
$$;

-- Keep at most one current Live competition. Activating another archives the previous one.
with ranked_live as (
  select id, row_number() over (order by event_date desc, created_at desc) as live_number
  from public.competitions
  where status = 'live'
)
update public.competitions
set status = 'complete'
where id in (select id from ranked_live where live_number > 1);

create unique index if not exists one_live_competition
on public.competitions ((status))
where status = 'live';

create or replace function public.archive_previous_live_competition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    update public.competitions
    set status = 'complete'
    where status = 'live' and id is distinct from new.id;
  end if;
  return new;
end; $$;

drop trigger if exists archive_previous_live_competition on public.competitions;
create trigger archive_previous_live_competition
before insert or update of status on public.competitions
for each row execute function public.archive_previous_live_competition();
