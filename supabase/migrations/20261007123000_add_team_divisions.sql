alter table public.teams
  add column gender text not null default 'mixed' check (gender in ('men', 'women', 'mixed')),
  add column category text not null default 'open' check (category in ('experience', 'open'));

comment on column public.teams.gender is 'Leaderboard team type: men, women, or mixed';
comment on column public.teams.category is 'Leaderboard category: experience or open';
