export type ScoreType = 'for-time' | 'amrap' | 'max-load'
export type ScoreStatus = 'scored' | 'capped' | 'dns'

export interface Participant {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  participants: Participant[]
  active: boolean
}

export interface Wod {
  id: string
  name: string
  description: string
  type: ScoreType
  capSeconds?: number
}

export interface Score {
  id: string
  teamId: string
  wodId: string
  status: ScoreStatus
  value: number
  tieBreak?: number
  penalty?: number
  submittedAt: string
}

export interface Heat {
  id: string
  wodId: string
  number: number
  laneTeamIds: Array<string | null>
  status: 'ready' | 'complete'
}

export interface CompetitionState {
  competition: {
    id?: string
    name: string
    date: string
    location: string
    status: 'draft' | 'live' | 'complete'
    publicSlug?: string
  }
  teams: Team[]
  wods: Wod[]
  scores: Score[]
  heats: Heat[]
  points: number[]
}

export interface RankedTeam extends Team {
  totalPoints: number
  position: number
  eventWins: number
  scoredEvents: number
  wodResults: Record<string, { place: number; points: number; score: Score }>
}
