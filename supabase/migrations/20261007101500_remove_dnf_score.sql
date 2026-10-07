alter table public.scores alter column status drop default;
alter table public.scores alter column status type text using status::text;
drop type public.score_status;
create type public.score_status as enum ('scored', 'capped', 'dns');
alter table public.scores alter column status type public.score_status using status::public.score_status;
alter table public.scores alter column status set default 'scored';
