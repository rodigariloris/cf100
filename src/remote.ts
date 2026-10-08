import { supabase } from './supabase'
import type { CompetitionState, ScoreStatus, ScoreType, TeamCategory, TeamGender } from './types'

export type CompetitionSummary = { id: string; name: string; date: string; location: string; status: CompetitionState['competition']['status'] }

export async function listCompetitions(): Promise<CompetitionSummary[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.from('competitions').select('id,name,event_date,location,status').order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((competition) => ({ id: competition.id, name: competition.name, date: competition.event_date, location: competition.location, status: competition.status }))
}

export async function loadCompetition(idOrSlug: string, bySlug = false): Promise<CompetitionState> {
  if (!supabase) throw new Error('Supabase is not configured')
  const competitionQuery = supabase.from('competitions').select('*')
  const { data: competition, error } = await (bySlug ? competitionQuery.eq('public_slug', idOrSlug) : competitionQuery.eq('id', idOrSlug)).single()
  if (error) throw error
  const id = competition.id as string
  const [{ data: teams }, { data: wods }, { data: points }] = await Promise.all([
    supabase.from('teams').select('*, participants(*)').eq('competition_id', id).order('created_at'),
    supabase.from('wods').select('*').eq('competition_id', id).order('sort_order'),
    supabase.from('position_points').select('*').eq('competition_id', id).order('position'),
  ])
  const wodIds = (wods ?? []).map((wod) => wod.id as string)
  const teamIds = (teams ?? []).map((team) => team.id as string)
  const [{ data: heats }, { data: scores }] = await Promise.all([
    wodIds.length ? supabase.from('heats').select('*, heat_lanes(*)').in('wod_id', wodIds).order('heat_number') : Promise.resolve({ data: [] }),
    wodIds.length && teamIds.length ? supabase.from('scores').select('*').in('wod_id', wodIds).in('team_id', teamIds) : Promise.resolve({ data: [] }),
  ])
  return {
    competition: { id, name: competition.name, date: competition.event_date, location: competition.location, status: competition.status, publicSlug: competition.public_slug },
    teams: (teams ?? []).map((team) => ({ id: team.id, name: team.name, active: team.active, gender: (team.gender ?? 'mixed') as TeamGender, category: (team.category ?? 'open') as TeamCategory, participants: (team.participants ?? []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order).map((participant: { id: string; name: string }) => ({ id: participant.id, name: participant.name })) })),
    wods: (wods ?? []).map((wod) => ({ id: wod.id, name: wod.name, description: wod.description, type: wod.score_type as ScoreType, capSeconds: wod.cap_seconds ?? undefined })),
    points: (points ?? []).map((point) => point.points),
    heats: (heats ?? []).map((heat) => ({ id: heat.id, wodId: heat.wod_id, number: heat.heat_number, status: heat.status, laneTeamIds: Array.from({ length: 4 }, (_, index) => heat.heat_lanes?.find((lane: { lane_number: number }) => lane.lane_number === index + 1)?.team_id ?? null) })),
    scores: (scores ?? []).map((score) => ({ id: score.id, wodId: score.wod_id, teamId: score.team_id, status: score.status as ScoreStatus, value: Number(score.value), tieBreak: score.tie_break == null ? undefined : Number(score.tie_break), penalty: Number(score.penalty), submittedAt: score.submitted_at })),
  }
}

export async function saveCompetition(state: CompetitionState) {
  if (!supabase || !state.competition.id) return
  const payload = {
    ...state,
    teams: state.teams.map((team) => ({ ...team, participants: team.participants.map((participant, sortOrder) => ({ ...participant, sortOrder })) })),
    wods: state.wods.map((wod, sortOrder) => ({ ...wod, sortOrder })),
  }
  const { error } = await supabase.rpc('save_competition_snapshot', { target_id: state.competition.id, payload })
  if (error) throw error
  const { error: divisionError } = await supabase.from('teams').upsert(state.teams.map((team) => ({ id: team.id, competition_id: state.competition.id!, name: team.name, active: team.active, gender: team.gender, category: team.category })))
  if (divisionError) throw divisionError
}

export async function createCompetition(name: string, date: string, location: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`
  const { data, error } = await supabase.rpc('create_staff_competition', { competition_name: name, competition_date: date, competition_location: location, competition_slug: slug })
  if (error) throw error
  return data as string
}
