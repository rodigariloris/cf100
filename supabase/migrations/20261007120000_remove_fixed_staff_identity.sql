create or replace function public.create_staff_competition(
  competition_name text,
  competition_date date,
  competition_location text,
  competition_slug text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.competitions (name, event_date, location, status, public_slug)
  values (competition_name, competition_date, competition_location, 'draft', competition_slug)
  returning id into new_id;
  insert into public.staff_members (competition_id, user_id) values (new_id, auth.uid());
  insert into public.position_points (competition_id, position, points) values
    (new_id, 1, 100), (new_id, 2, 90), (new_id, 3, 85), (new_id, 4, 80),
    (new_id, 5, 75), (new_id, 6, 70), (new_id, 7, 65), (new_id, 8, 60);
  return new_id;
end; $$;

create or replace function public.save_competition_snapshot(target_id uuid, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; member jsonb; lane jsonb;
begin
  if not public.is_competition_staff(target_id) then raise exception 'Not authorized'; end if;

  update public.competitions set name = payload #>> '{competition,name}', event_date = (payload #>> '{competition,date}')::date,
    location = payload #>> '{competition,location}', status = (payload #>> '{competition,status}')::public.competition_status,
    public_slug = payload #>> '{competition,publicSlug}' where id = target_id;
  delete from public.teams where competition_id = target_id;
  delete from public.wods where competition_id = target_id;
  delete from public.position_points where competition_id = target_id;

  for item in select * from jsonb_array_elements(coalesce(payload->'teams', '[]'::jsonb)) loop
    insert into public.teams (id, competition_id, name, active) values ((item->>'id')::uuid, target_id, item->>'name', (item->>'active')::boolean);
    for member in select * from jsonb_array_elements(coalesce(item->'participants', '[]'::jsonb)) loop
      insert into public.participants (id, team_id, name, sort_order) values ((member->>'id')::uuid, (item->>'id')::uuid, member->>'name', coalesce((member->>'sortOrder')::integer, 0));
    end loop;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'wods', '[]'::jsonb)) loop
    insert into public.wods (id, competition_id, name, description, score_type, cap_seconds, sort_order) values ((item->>'id')::uuid, target_id, item->>'name', coalesce(item->>'description', ''), (item->>'type')::public.score_type, (item->>'capSeconds')::integer, coalesce((item->>'sortOrder')::integer, 0));
  end loop;
  for item in select jsonb_build_object('value', value, 'ordinality', ordinality) from jsonb_array_elements(coalesce(payload->'points', '[]'::jsonb)) with ordinality loop
    insert into public.position_points (competition_id, position, points) values (target_id, (item->>'ordinality')::integer, (item->>'value')::integer);
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'heats', '[]'::jsonb)) loop
    insert into public.heats (id, wod_id, heat_number, status) values ((item->>'id')::uuid, (item->>'wodId')::uuid, (item->>'number')::integer, (item->>'status')::public.heat_status);
    for lane in select jsonb_build_object('value', value, 'ordinality', ordinality) from jsonb_array_elements(coalesce(item->'laneTeamIds', '[]'::jsonb)) with ordinality loop
      insert into public.heat_lanes (heat_id, lane_number, team_id) values ((item->>'id')::uuid, (lane->>'ordinality')::integer, nullif(lane->>'value', '')::uuid);
    end loop;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'scores', '[]'::jsonb)) loop
    insert into public.scores (id, wod_id, team_id, status, value, tie_break, penalty, submitted_by, submitted_at)
    values ((item->>'id')::uuid, (item->>'wodId')::uuid, (item->>'teamId')::uuid, (item->>'status')::public.score_status,
      (item->>'value')::numeric, (item->>'tieBreak')::numeric, coalesce((item->>'penalty')::numeric, 0), auth.uid(), (item->>'submittedAt')::timestamptz);
  end loop;
end; $$;

revoke execute on function public.create_staff_competition(text, date, text, text) from public, anon;
revoke execute on function public.save_competition_snapshot(uuid, jsonb) from public, anon;
grant execute on function public.create_staff_competition(text, date, text, text) to authenticated;
grant execute on function public.save_competition_snapshot(uuid, jsonb) to authenticated;
