import type { CompetitionState } from './types'

export const initialState: CompetitionState = {
  competition: {
    name: 'CF100 OPEN DAY',
    date: '2026-09-19',
    location: 'CrossFit 100 Aurì',
    status: 'live',
  },
  teams: [
    { id: 't1', name: 'Barbell Rebels', active: true, participants: [{ id: 'p1', name: 'Marta Rossi' }, { id: 'p2', name: 'Luca Bianchi' }] },
    { id: 't2', name: 'No Rep Club', active: true, participants: [{ id: 'p3', name: 'Anna Conti' }, { id: 'p4', name: 'Marco Villa' }] },
    { id: 't3', name: 'Chalk Monsters', active: true, participants: [{ id: 'p5', name: 'Sara Galli' }, { id: 'p6', name: 'Paolo Riva' }] },
    { id: 't4', name: 'WOD Warriors', active: true, participants: [{ id: 'p7', name: 'Giulia Sala' }, { id: 'p8', name: 'Davide Fontana' }] },
    { id: 't5', name: 'Burpee Business', active: true, participants: [{ id: 'p9', name: 'Elisa Fumagalli' }, { id: 'p10', name: 'Andrea Greco' }] },
    { id: 't6', name: 'The Franatics', active: true, participants: [{ id: 'p11', name: 'Irene Moretti' }, { id: 'p12', name: 'Matteo Ferri' }] },
    { id: 't7', name: 'Thruster Society', active: true, participants: [{ id: 'p13', name: 'Laura Costa' }, { id: 'p14', name: 'Simone Longo' }] },
    { id: 't8', name: 'Double Trouble', active: true, participants: [{ id: 'p15', name: 'Chiara Testa' }, { id: 'p16', name: 'Fabio Romano' }] },
  ],
  wods: [
    { id: 'w1', name: 'Burn Notice', description: '21-15-9 thrusters and bar-facing burpees', type: 'for-time', capSeconds: 720 },
    { id: 'w2', name: 'Engine Room', description: '12 minute AMRAP: row, box jumps, toes-to-bar', type: 'amrap' },
    { id: 'w3', name: 'Heavy Weather', description: 'Complex: clean, hang clean, front squat', type: 'max-load' },
  ],
  scores: [
    { id: 's1', teamId: 't1', wodId: 'w1', status: 'scored', value: 438, submittedAt: '2026-09-19T08:30:00Z' },
    { id: 's2', teamId: 't2', wodId: 'w1', status: 'scored', value: 461, submittedAt: '2026-09-19T08:31:00Z' },
    { id: 's3', teamId: 't3', wodId: 'w1', status: 'scored', value: 425, submittedAt: '2026-09-19T08:32:00Z' },
    { id: 's4', teamId: 't4', wodId: 'w1', status: 'scored', value: 509, submittedAt: '2026-09-19T08:33:00Z' },
  ],
  heats: [
    { id: 'h1', wodId: 'w1', number: 1, laneTeamIds: ['t1', 't2', 't3', 't4'], status: 'complete' },
    { id: 'h2', wodId: 'w1', number: 2, laneTeamIds: ['t5', 't6', 't7', 't8'], status: 'ready' },
  ],
  points: [100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40],
}

export function uid(prefix: string) {
  void prefix
  return crypto.randomUUID()
}
