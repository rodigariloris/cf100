import { describe, expect, it } from 'vitest'
import { buildLeaderboard } from './scoring'
import type { CompetitionState } from './types'

describe('competition scoring', () => {
  it('assigns tied teams the same place and skips the next place', () => {
    const team = (id: string) => ({ id, name: id, active: true, gender: 'mixed' as const, category: 'open' as const, participants: [] })
    const state: CompetitionState = {
      competition: { name: 'Test', date: '2026-10-07', location: '', status: 'live' },
      teams: [team('alpha'), team('bravo'), team('charlie'), team('delta')],
      wods: [{ id: 'wod', name: 'Sprint', description: '', type: 'for-time' }],
      scores: [
        { id: '1', teamId: 'alpha', wodId: 'wod', status: 'scored', value: 100, submittedAt: '2026-10-07T08:00:00Z' },
        { id: '2', teamId: 'bravo', wodId: 'wod', status: 'scored', value: 110, submittedAt: '2026-10-07T08:01:00Z' },
        { id: '3', teamId: 'charlie', wodId: 'wod', status: 'scored', value: 110, submittedAt: '2026-10-07T08:02:00Z' },
        { id: '4', teamId: 'delta', wodId: 'wod', status: 'scored', value: 120, submittedAt: '2026-10-07T08:03:00Z' },
      ],
      heats: [],
      points: [100, 90, 80, 70],
    }

    const results = buildLeaderboard(state)
    const byTeam = Object.fromEntries(results.map((result) => [result.id, result.wodResults.wod]))

    expect(byTeam.alpha).toMatchObject({ place: 1, points: 100 })
    expect(byTeam.bravo).toMatchObject({ place: 2, points: 90 })
    expect(byTeam.charlie).toMatchObject({ place: 2, points: 90 })
    expect(byTeam.delta).toMatchObject({ place: 4, points: 70 })
  })

  it('ranks finishers before capped teams and capped teams by completed reps', () => {
    const team = (id: string) => ({ id, name: id, active: true, gender: 'mixed' as const, category: 'open' as const, participants: [] })
    const state: CompetitionState = {
      competition: { name: 'Test', date: '2026-10-07', location: '', status: 'live' },
      teams: [team('finisher'), team('more-reps'), team('fewer-reps')],
      wods: [{ id: 'wod', name: 'Chipper', description: '', type: 'for-time', capSeconds: 720 }],
      scores: [
        { id: '1', teamId: 'finisher', wodId: 'wod', status: 'scored', value: 700, submittedAt: '2026-10-07T08:00:00Z' },
        { id: '2', teamId: 'fewer-reps', wodId: 'wod', status: 'capped', value: 720, tieBreak: 120, submittedAt: '2026-10-07T08:01:00Z' },
        { id: '3', teamId: 'more-reps', wodId: 'wod', status: 'capped', value: 720, tieBreak: 135, submittedAt: '2026-10-07T08:02:00Z' },
      ],
      heats: [],
      points: [100, 90, 80],
    }

    const results = buildLeaderboard(state)
    expect(results.map((result) => result.id)).toEqual(['finisher', 'more-reps', 'fewer-reps'])
    expect(results.map((result) => result.wodResults.wod.place)).toEqual([1, 2, 3])
  })

  it('ranks and awards points independently inside each division', () => {
    const state: CompetitionState = {
      competition: { name: 'Test', date: '2026-10-07', location: '', status: 'live' },
      teams: [
        { id: 'men', name: 'Men', active: true, gender: 'men', category: 'open', participants: [] },
        { id: 'women', name: 'Women', active: true, gender: 'women', category: 'open', participants: [] },
      ],
      wods: [{ id: 'wod', name: 'Sprint', description: '', type: 'for-time' }],
      scores: [
        { id: '1', teamId: 'men', wodId: 'wod', status: 'scored', value: 100, submittedAt: '2026-10-07T08:00:00Z' },
        { id: '2', teamId: 'women', wodId: 'wod', status: 'scored', value: 120, submittedAt: '2026-10-07T08:01:00Z' },
      ],
      heats: [],
      points: [100, 90],
    }

    const results = buildLeaderboard(state)
    expect(results.map((team) => ({ id: team.id, place: team.wodResults.wod.place, points: team.totalPoints }))).toEqual([
      { id: 'men', place: 1, points: 100 },
      { id: 'women', place: 1, points: 100 },
    ])
  })
})
