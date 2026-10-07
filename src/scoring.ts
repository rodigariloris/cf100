import type { CompetitionState, RankedTeam, Score, Wod } from './types'

export function effectiveValue(score: Score, wod: Wod) {
  const penalty = score.penalty ?? 0
  return wod.type === 'for-time' ? score.value + penalty : score.value - penalty
}

export function compareScores(a: Score, b: Score, wod: Wod) {
  const statusOrder = { scored: 0, capped: 1, dns: 2 }
  if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status]
  if (a.status === 'capped') return (b.tieBreak ?? 0) - (a.tieBreak ?? 0)
  if (a.status !== 'scored') return a.submittedAt.localeCompare(b.submittedAt)

  const first = effectiveValue(a, wod)
  const second = effectiveValue(b, wod)
  if (first !== second) return wod.type === 'for-time' ? first - second : second - first

  const firstTie = a.tieBreak ?? Number.POSITIVE_INFINITY
  const secondTie = b.tieBreak ?? Number.POSITIVE_INFINITY
  return firstTie - secondTie
}

function scoresAreTied(a: Score, b: Score, wod: Wod) {
  if (a.status === 'capped' && b.status === 'capped') return (a.tieBreak ?? 0) === (b.tieBreak ?? 0)
  if (a.status !== 'scored' || b.status !== 'scored') return false
  return effectiveValue(a, wod) === effectiveValue(b, wod) &&
    (a.tieBreak ?? null) === (b.tieBreak ?? null)
}

export function buildLeaderboard(state: CompetitionState): RankedTeam[] {
  const ranked: RankedTeam[] = state.teams.filter((team) => team.active).map((team) => ({
    ...team,
    totalPoints: 0,
    position: 0,
    eventWins: 0,
    scoredEvents: 0,
    wodResults: {} as RankedTeam['wodResults'],
  }))

  const divisions = [...new Set(ranked.map((team) => `${team.gender}:${team.category}`))]
  for (const wod of state.wods) {
    for (const division of divisions) {
      const divisionTeamIds = new Set(ranked.filter((team) => `${team.gender}:${team.category}` === division).map((team) => team.id))
      const eventScores = state.scores.filter((score) => score.wodId === wod.id && divisionTeamIds.has(score.teamId)).sort((a, b) => compareScores(a, b, wod))
      let previousPlace = 0
      eventScores.forEach((score, index) => {
        const team = ranked.find((candidate) => candidate.id === score.teamId)
        if (!team) return
        const place = index > 0 && scoresAreTied(score, eventScores[index - 1], wod) ? previousPlace : index + 1
        previousPlace = place
        const points = score.status === 'dns' ? 0 : (state.points[place - 1] ?? 0)
        team.totalPoints += points
        team.scoredEvents += 1
        if (place === 1) team.eventWins += 1
        team.wodResults[wod.id] = { place, points, score }
      })
    }
  }

  ranked.sort((a, b) =>
    a.gender.localeCompare(b.gender) ||
    a.category.localeCompare(b.category) ||
    b.totalPoints - a.totalPoints ||
    b.eventWins - a.eventWins ||
    b.scoredEvents - a.scoredEvents ||
    a.name.localeCompare(b.name),
  )
  ranked.forEach((team, index) => {
    const previous = ranked[index - 1]
    team.position = previous &&
      team.gender === previous.gender &&
      team.category === previous.category &&
      team.totalPoints === previous.totalPoints &&
      team.eventWins === previous.eventWins &&
      team.scoredEvents === previous.scoredEvents
      ? previous.position
      : ranked.slice(0, index).filter((candidate) => candidate.gender === team.gender && candidate.category === team.category).length + 1
  })
  return ranked
}

export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.max(0, Math.round(totalSeconds % 60))
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatScore(score: Score, wod: Wod) {
  if (score.status === 'capped') return `${formatTime(score.value)} cap · ${score.tieBreak ?? 0} reps`
  if (score.status === 'dns') return 'Did not start'
  if (wod.type === 'for-time') return formatTime(score.value)
  if (wod.type === 'max-load') return `${score.value} kg`
  return `${score.value} reps`
}
