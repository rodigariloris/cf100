import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, Check, ChevronRight, CircleDot, Clock3, Copy, Dumbbell, Gauge, LayoutDashboard, ListOrdered, Menu, Pencil, Plus, RotateCcw, Settings, ShieldCheck, Trash2, Trophy, Users, X } from 'lucide-react'
import './App.css'
import { uid } from './data'
import { buildLeaderboard, formatScore } from './scoring'
import type { CompetitionState, Heat, Score, ScoreStatus, ScoreType, Team, TeamCategory, TeamGender, Wod } from './types'
import { useCompetition } from './useCompetition'

type View = 'overview' | 'teams' | 'wods' | 'floor' | 'leaderboard' | 'settings'
type StateProps = { state: CompetitionState; setState: React.Dispatch<React.SetStateAction<CompetitionState>> }
const today = new Date().toISOString().slice(0, 10)

const navItems: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'teams', label: 'Teams', icon: Users },
  { id: 'wods', label: 'WODs', icon: Dumbbell }, { id: 'floor', label: 'Floor', icon: Activity },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }, { id: 'settings', label: 'Settings', icon: Settings },
]
const scoreLabels: Record<ScoreType, string> = { 'for-time': 'For time', amrap: 'AMRAP / reps', 'max-load': 'Max load' }
const genderLabels: Record<TeamGender, string> = { men: 'Men', women: 'Women', mixed: 'Mixed' }
const categoryLabels: Record<TeamCategory, string> = { experience: 'Experience', open: 'Open' }
const pathToView = (path: string): View => navItems.some((item) => `/${item.id}` === path) ? path.slice(1) as View : 'overview'

function App() {
  const competition = useCompetition()
  const { state, setState, reset } = competition
  const [view, setView] = useState<View>(() => pathToView(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)
  const leaderboard = useMemo(() => buildLeaderboard(state), [state])
  const navigate = (next: View) => { window.history.pushState({}, '', `/${next}`); setView(next); setMenuOpen(false) }
  useEffect(() => {
    const restore = () => setView(pathToView(window.location.pathname))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  useEffect(() => {
    if (competition.readOnly || !competition.remoteConfigured) return
    if (!competition.session && window.location.pathname !== '/login') {
      const next = window.location.pathname === '/' ? '/overview' : window.location.pathname
      window.history.replaceState({}, '', `/login?next=${encodeURIComponent(next)}`)
    } else if (competition.session && window.location.pathname === '/login') {
      const next = new URLSearchParams(window.location.search).get('next') || '/overview'
      window.history.replaceState({}, '', next)
      setView(pathToView(next))
    }
  }, [competition.readOnly, competition.remoteConfigured, competition.session])
  if (competition.loading) return <LoadingScreen />
  if (competition.readOnly) return competition.error ? <AuthMessage title="Leaderboard unavailable" message={competition.error} /> : <LeaderboardView state={state} />
  if (!competition.remoteConfigured) return <AuthMessage title="Configuration required" message="Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment build variables, then redeploy." />
  if (competition.remoteConfigured && !competition.session) return <LoginScreen signIn={competition.signIn} />
  if (competition.needsSetup) return <CompetitionSetup onSubmit={competition.setupCompetition} />
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
      <button className="brand" onClick={() => navigate('overview')}><span className="brand-mark"><b>CF</b><strong>100</strong></span><span><b>Competition desk</b><small>All in. All day.</small></span></button>
      <nav aria-label="Main navigation">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon />{item.label}</button> })}</nav>
      <div className="event-chip"><span className="live-dot" /><div><small>Live competition</small><strong>{state.competition.name}</strong></div></div>
    </aside>
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button><div><small>{state.competition.location}</small><strong>{new Date(`${state.competition.date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div><span className={`sync-state ${competition.syncStatus}`}><CircleDot />{competition.syncStatus === 'local' ? 'This device' : competition.syncStatus === 'saving' ? 'Saving' : competition.syncStatus === 'error' ? 'Save failed' : 'Online'}</span><button className="public-link" onClick={() => navigate('leaderboard')}><CircleDot /> Public board <ChevronRight /></button>{competition.session && <button className="sign-out" onClick={() => void competition.signOut()}>Sign out</button>}</header>
      {competition.error && <div className="sync-error">{competition.error}</div>}
      {view === 'overview' && <Overview state={state} leaderboard={leaderboard} navigate={navigate} />}
      {view === 'teams' && <TeamsView state={state} setState={setState} />}
      {view === 'wods' && <WodsView state={state} setState={setState} />}
      {view === 'floor' && <FloorView state={state} setState={setState} />}
      {view === 'leaderboard' && <LeaderboardView state={state} />}
      {view === 'settings' && <SettingsView state={state} setState={setState} reset={reset} />}
    </main>
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
  </div>
}

function LoadingScreen() { return <div className="auth-shell"><div className="auth-brand"><span className="brand-mark"><b>CF</b><strong>100</strong></span><small>Connecting to competition desk</small></div><div className="loading-line" /></div> }

function AuthMessage({ title, message }: { title: string; message: string }) { return <div className="auth-shell"><section className="auth-panel"><small>CF100 Competition desk</small><h1>{title}</h1><p>{message}</p></section></div> }

function LoginScreen({ signIn }: { signIn: (username: string, password: string) => Promise<string> }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(await signIn(email, password)); setBusy(false) }
  return <div className="auth-shell"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark"><b>CF</b><strong>100</strong></span><small>Staff access</small></div><h1>Competition desk</h1><p>Sign in with a staff account. Your session remains valid for three hours.</p><form onSubmit={submit}><label>Email<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <div className="auth-error">{message}</div>}<button className="primary large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ChevronRight /></button></form></section></div>
}

function CompetitionSetup({ onSubmit }: { onSubmit: (name: string, date: string, location: string) => Promise<void> }) {
  const [name, setName] = useState('CF100 Open Day'), [date, setDate] = useState(today), [location, setLocation] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await onSubmit(name, date, location) } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Could not create competition') } finally { setBusy(false) } }
  return <div className="auth-shell"><section className="auth-panel setup-panel"><small>First run</small><h1>Create your competition</h1><p>This account has no event yet. These details create the hosted database workspace.</p><form onSubmit={submit}><label>Competition name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} required /></label>{message && <div className="auth-error">{message}</div>}<button className="primary large" disabled={busy}>{busy ? 'Creating…' : 'Create competition'} <ChevronRight /></button></form></section></div>
}

function PageHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) { return <div className="page-heading"><div><small>{eyebrow}</small><h1>{title}</h1></div>{action}</div> }

function Overview({ state, leaderboard, navigate }: { state: CompetitionState; leaderboard: ReturnType<typeof buildLeaderboard>; navigate: (v: View) => void }) {
  const possible = state.teams.filter((t) => t.active).length * state.wods.length
  const nextHeat = state.heats.find((heat) => heat.status === 'ready'), nextWod = state.wods.find((wod) => wod.id === nextHeat?.wodId)
  return <div className="page">
    <section className="hero-band"><div><small>Race control</small><h1>Keep the floor moving.</h1><p>{state.teams.length} teams. {state.wods.length} tests. Four lanes. One live table.</p></div><button className="primary large" onClick={() => navigate('floor')}>Open floor control <ChevronRight /></button></section>
    <div className="dashboard-grid">
      <section className="next-heat panel"><div className="section-title"><span><Clock3 /> Up next</span><button className="text-button" onClick={() => navigate('floor')}>Manage floor</button></div>{nextHeat && nextWod ? <><div className="heat-head"><div><small>Heat {nextHeat.number}</small><h2>{nextWod.name}</h2></div><span className="type-pill">{scoreLabels[nextWod.type]}</span></div><div className="mini-lanes">{nextHeat.laneTeamIds.map((teamId, index) => <div key={index}><small>Lane {index + 1}</small><strong>{state.teams.find((t) => t.id === teamId)?.name ?? 'Open lane'}</strong></div>)}</div></> : <EmptyState title="Floor is clear" body="Create a heat when you are ready." />}</section>
      <section className="progress-panel panel"><div className="section-title"><span><Activity /> Event progress</span></div><strong className="progress-copy">{state.scores.length}<span> / {possible} scores</span></strong><div className="progress-track"><i style={{ width: `${possible ? state.scores.length / possible * 100 : 0}%` }} /></div><p>{Math.round(possible ? state.scores.length / possible * 100 : 0)}% of all results are locked in.</p></section>
      <section className="standings panel"><div className="section-title"><span><Trophy /> Running leaders</span><button className="text-button" onClick={() => navigate('leaderboard')}>Full table</button></div><div className="leader-list">{leaderboard.slice(0, 5).map((team) => <div key={team.id}><b>{team.position.toString().padStart(2, '0')}</b><span><strong>{team.name}</strong><small>{team.participants.map((p) => p.name.split(' ')[0]).join(' + ')}</small></span><em>{team.totalPoints}<small> pts</small></em></div>)}</div></section>
      <section className="quick-actions panel"><div className="section-title"><span><Gauge /> Quick actions</span></div>{[[Users, 'Add a team', 'Register athletes', 'teams'], [Dumbbell, 'Create a WOD', 'Set scoring rules', 'wods'], [ListOrdered, 'Build a heat', 'Fill four lanes', 'floor']].map(([Icon, label, hint, destination]) => { const I = Icon as typeof Users; return <button key={label as string} onClick={() => navigate(destination as View)}><I /><span><strong>{label as string}</strong><small>{hint as string}</small></span><ChevronRight /></button> })}</section>
    </div>
  </div>
}

function TeamsView({ state, setState }: StateProps) {
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [athletes, setAthletes] = useState(['', ''])
  const [gender, setGender] = useState<TeamGender>('mixed'), [category, setCategory] = useState<TeamCategory>('open')
  const [editing, setEditing] = useState<Team | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim() || athletes.some((a) => !a.trim())) return; const team: Team = { id: uid('team'), name: name.trim(), active: true, gender, category, participants: athletes.map((athlete) => ({ id: uid('athlete'), name: athlete.trim() })) }; setState((current) => ({ ...current, teams: [...current.teams, team] })); setName(''); setAthletes(['', '']); setGender('mixed'); setCategory('open'); setAdding(false) }
  function saveEdit(event: FormEvent) { event.preventDefault(); if (!editing?.name.trim() || editing.participants.some((p) => !p.name.trim())) return; setState((current) => ({ ...current, teams: current.teams.map((team) => team.id === editing.id ? editing : team) })); setEditing(null) }
  function deleteTeam(teamId: string) { setState((current) => ({ ...current, teams: current.teams.filter((team) => team.id !== teamId), scores: current.scores.filter((score) => score.teamId !== teamId), heats: current.heats.map((heat) => ({ ...heat, laneTeamIds: heat.laneTeamIds.map((id) => id === teamId ? null : id) })) })); setPendingDelete(null); if (editing?.id === teamId) setEditing(null) }
  return <div className="page"><PageHeading eyebrow="Roster" title={`${state.teams.length} teams`} action={<button className="primary" onClick={() => setAdding(!adding)}><Plus /> Add team</button>} />
    {adding && <form className="inline-form" onSubmit={submit}><div className="form-copy"><small>New registration</small><h2>Build the team</h2><p>Division determines which leaderboard the team competes in.</p></div><label>Team name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chalk Monsters" required /></label><label>Team type<select value={gender} onChange={(e) => setGender(e.target.value as TeamGender)}>{Object.entries(genderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value as TeamCategory)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{athletes.map((athlete, index) => <label key={index}>Athlete {index + 1}<input value={athlete} onChange={(e) => setAthletes((current) => current.map((value, i) => i === index ? e.target.value : value))} placeholder="Full name" required /></label>)}<div className="form-actions"><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancel</button><button className="primary"><Check /> Save team</button></div></form>}
    <div className="data-list team-list"><div className="list-head"><span>Team</span><span>Athletes</span><span>Status</span><span>Actions</span></div>{state.teams.map((team, index) => <div className="team-record" key={team.id}><div className="list-row"><span className="team-name"><b>{(index + 1).toString().padStart(2, '0')}</b><span><strong>{team.name}</strong><small>{genderLabels[team.gender]} · {categoryLabels[team.category]}</small></span></span><span>{team.participants.map((p) => p.name).join(' · ')}</span><button className={`status-control ${team.active ? 'is-active' : ''}`} onClick={() => setState((current) => ({ ...current, teams: current.teams.map((candidate) => candidate.id === team.id ? { ...candidate, active: !candidate.active } : candidate) }))}>{team.active ? 'Active' : 'Withdrawn'}</button><span className="row-actions"><button onClick={() => { setEditing(team); setPendingDelete(null) }} aria-label={`Edit ${team.name}`}><Pencil /> Edit</button>{pendingDelete === team.id ? <><button className="confirm-delete" onClick={() => deleteTeam(team.id)}><Trash2 /> Confirm</button><button onClick={() => setPendingDelete(null)}>Cancel</button></> : <button onClick={() => { setPendingDelete(team.id); setEditing(null) }} aria-label={`Delete ${team.name}`}><Trash2 /> Delete</button>}</span></div>{editing?.id === team.id && <form className="team-edit" onSubmit={saveEdit}><label>Team name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></label><label>Team type<select value={editing.gender} onChange={(e) => setEditing({ ...editing, gender: e.target.value as TeamGender })}>{Object.entries(genderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Category<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as TeamCategory })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{editing.participants.map((participant, participantIndex) => <label key={participant.id}>Athlete {participantIndex + 1}<input value={participant.name} onChange={(e) => setEditing({ ...editing, participants: editing.participants.map((candidate) => candidate.id === participant.id ? { ...candidate, name: e.target.value } : candidate) })} required /></label>)}<div className="form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button className="primary"><Check /> Save changes</button></div></form>}</div>)}</div>
  </div>
}

function WodsView({ state, setState }: StateProps) {
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [description, setDescription] = useState(''), [type, setType] = useState<ScoreType>('for-time')
  const [capMinutes, setCapMinutes] = useState('12')
  const [editing, setEditing] = useState<Wod | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; const wod: Wod = { id: uid('wod'), name: name.trim(), description: description.trim(), type, capSeconds: type === 'for-time' ? Number(capMinutes) * 60 : undefined }; setState((current) => ({ ...current, wods: [...current.wods, wod] })); setName(''); setDescription(''); setCapMinutes('12'); setAdding(false) }
  function saveEdit(event: FormEvent) { event.preventDefault(); if (!editing?.name.trim()) return; setState((current) => ({ ...current, wods: current.wods.map((wod) => wod.id === editing.id ? editing : wod) })); setEditing(null) }
  function deleteWod(wodId: string) { setState((current) => ({ ...current, wods: current.wods.filter((wod) => wod.id !== wodId), scores: current.scores.filter((score) => score.wodId !== wodId), heats: current.heats.filter((heat) => heat.wodId !== wodId) })); setPendingDelete(null); if (editing?.id === wodId) setEditing(null) }
  return <div className="page"><PageHeading eyebrow="Programming" title={`${state.wods.length} competition tests`} action={<button className="primary" onClick={() => setAdding(!adding)}><Plus /> Add WOD</button>} />
    {adding && <form className="inline-form wod-form" onSubmit={submit}><div className="form-copy"><small>New test</small><h2>Set the standard</h2><p>Lower time wins; higher reps or load wins.</p></div><label>WOD name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label><label>Scoring<select value={type} onChange={(e) => setType(e.target.value as ScoreType)}>{Object.entries(scoreLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{type === 'for-time' && <label>Time cap (minutes)<input type="number" min="1" value={capMinutes} onChange={(event) => setCapMinutes(event.target.value)} required /></label>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancel</button><button className="primary"><Check /> Save WOD</button></div></form>}
    <div className="wod-stack">{state.wods.map((wod, index) => <article key={wod.id} className="wod-record"><div className="wod-row"><span className="wod-index">W{index + 1}</span><div><small>{scoreLabels[wod.type]}{wod.type === 'for-time' && wod.capSeconds ? ` · ${wod.capSeconds / 60} min cap` : ''}</small><h2>{wod.name}</h2><p>{wod.description || 'No workout description yet.'}</p></div><div className="wod-meta"><strong>{state.scores.filter((s) => s.wodId === wod.id).length}/{state.teams.filter((t) => t.active).length}</strong><small>results</small></div><span className="row-actions wod-actions"><button onClick={() => { setEditing(wod); setPendingDelete(null) }} aria-label={`Edit ${wod.name}`}><Pencil /> Edit</button>{pendingDelete === wod.id ? <><button className="confirm-delete" onClick={() => deleteWod(wod.id)}><Trash2 /> Confirm</button><button onClick={() => setPendingDelete(null)}>Cancel</button></> : <button onClick={() => { setPendingDelete(wod.id); setEditing(null) }} aria-label={`Delete ${wod.name}`}><Trash2 /> Delete</button>}</span></div>{editing?.id === wod.id && <form className="wod-edit" onSubmit={saveEdit}><label>WOD name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required /></label><label>Description<textarea rows={3} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><label>Scoring<select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as ScoreType, capSeconds: event.target.value === 'for-time' ? editing.capSeconds ?? 720 : undefined })}>{Object.entries(scoreLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{editing.type === 'for-time' && <label>Time cap (minutes)<input type="number" min="1" value={(editing.capSeconds ?? 720) / 60} onChange={(event) => setEditing({ ...editing, capSeconds: Number(event.target.value) * 60 })} required /></label>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button className="primary"><Check /> Save changes</button></div></form>}</article>)}</div>
    <PointsEditor points={state.points} teamCount={state.teams.filter((team) => team.active).length} onChange={(points) => setState((current) => ({ ...current, points }))} />
  </div>
}

function PointsEditor({ points, teamCount, onChange }: { points: number[]; teamCount: number; onChange: (points: number[]) => void }) {
  const visibleCount = Math.max(teamCount, points.length)
  const values = Array.from({ length: visibleCount }, (_, index) => points[index] ?? 0)
  return <section className="points-editor"><div className="points-copy"><small>Competition scoring</small><h2>Points by finishing position</h2><p>One table applies to every WOD. Tied teams receive the points for their shared position, and the following place is skipped.</p></div><div className="points-grid">{values.map((value, index) => <label key={index}><span>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</span><input type="number" min="0" value={value} onChange={(event) => { const next = [...values]; next[index] = Math.max(0, Number(event.target.value)); onChange(next) }} /><small>pts</small></label>)}</div></section>
}

function FloorView({ state, setState }: StateProps) {
  const [wodId, setWodId] = useState(state.wods[0]?.id ?? '')
  const currentWod = state.wods.find((wod) => wod.id === wodId), wodHeats = state.heats.filter((heat) => heat.wodId === wodId)
  const [heatId, setHeatId] = useState(wodHeats.find((h) => h.status === 'ready')?.id ?? wodHeats[0]?.id ?? '')
  const currentHeat = state.heats.find((heat) => heat.id === heatId && heat.wodId === wodId) ?? wodHeats[0]
  function selectWod(nextWod: string) { setWodId(nextWod); const heats = state.heats.filter((heat) => heat.wodId === nextWod); setHeatId(heats.find((h) => h.status === 'ready')?.id ?? heats[0]?.id ?? '') }
  function addHeat() { const eligible = state.teams.filter((team) => team.active && !state.scores.some((score) => score.wodId === wodId && score.teamId === team.id)); const heat: Heat = { id: uid('heat'), wodId, number: wodHeats.length + 1, laneTeamIds: eligible.slice(0, 4).map((t) => t.id), status: 'ready' }; while (heat.laneTeamIds.length < 4) heat.laneTeamIds.push(null); setState((current) => ({ ...current, heats: [...current.heats, heat] })); setHeatId(heat.id) }
  if (!currentWod) return <div className="page"><EmptyState title="Add your first WOD" body="Floor control becomes available once a test exists." /></div>
  return <div className="page floor-page"><PageHeading eyebrow="Race control" title="Floor assignment" action={<button className="primary" onClick={addHeat}><Plus /> New heat</button>} /><div className="floor-toolbar"><label>WOD<select value={wodId} onChange={(e) => selectWod(e.target.value)}>{state.wods.map((wod) => <option value={wod.id} key={wod.id}>{wod.name}</option>)}</select></label><div className="heat-tabs">{wodHeats.map((heat) => <button className={currentHeat?.id === heat.id ? 'active' : ''} key={heat.id} onClick={() => setHeatId(heat.id)}>Heat {heat.number}{heat.status === 'complete' && <Check />}</button>)}</div></div>{currentHeat ? <HeatEditor key={currentHeat.id} state={state} heat={currentHeat} wod={currentWod} setState={setState} /> : <EmptyState title="No heat yet" body="Create a heat and we will fill the lanes with eligible teams." action={<button className="primary" onClick={addHeat}><Plus /> Create first heat</button>} />}</div>
}

function HeatEditor({ state, heat, wod, setState }: { state: CompetitionState; heat: Heat; wod: Wod; setState: StateProps['setState'] }) {
  const existing = (teamId: string) => state.scores.find((score) => score.wodId === wod.id && score.teamId === teamId)
  type ScoreEntry = { value: string; reps: string; status: ScoreStatus }
  const [entries, setEntries] = useState<Record<string, ScoreEntry>>(() => Object.fromEntries(heat.laneTeamIds.filter(Boolean).map((teamId) => [teamId!, { value: existing(teamId!)?.value.toString() ?? '', reps: existing(teamId!)?.tieBreak?.toString() ?? '', status: existing(teamId!)?.status ?? 'scored' }])))
  const [editingTeams, setEditingTeams] = useState<Record<string, boolean>>({})
  const [justPublished, setJustPublished] = useState<string | null>(null)
  const assignedElsewhere = state.heats.filter((h) => h.wodId === wod.id && h.id !== heat.id).flatMap((h) => h.laneTeamIds)
  function assign(lane: number, teamId: string) { setState((current) => ({ ...current, heats: current.heats.map((candidate) => candidate.id === heat.id ? { ...candidate, laneTeamIds: candidate.laneTeamIds.map((value, index) => index === lane ? teamId || null : value) } : candidate) })); if (teamId) setEntries((current) => ({ ...current, [teamId]: current[teamId] ?? { value: '', reps: '', status: 'scored' } })) }
  function entryIsValid(entry: ScoreEntry) { return entry.status === 'capped' ? entry.reps !== '' : entry.status === 'dns' || entry.value !== '' }
  function beginEdit(teamId: string) {
    const score = existing(teamId)
    if (score) setEntries((current) => ({ ...current, [teamId]: { value: score.value.toString(), reps: score.tieBreak?.toString() ?? '', status: score.status } }))
    setEditingTeams((current) => ({ ...current, [teamId]: true }))
  }
  function cancelEdit(teamId: string) {
    const score = existing(teamId)
    if (score) setEntries((current) => ({ ...current, [teamId]: { value: score.value.toString(), reps: score.tieBreak?.toString() ?? '', status: score.status } }))
    setEditingTeams((current) => ({ ...current, [teamId]: false }))
  }
  function submitTeam(teamId: string) {
    const entry = entries[teamId]
    if (!entry || !entryIsValid(entry)) return
    const score: Score = { id: existing(teamId)?.id ?? uid('score'), teamId, wodId: wod.id, status: entry.status, value: entry.status === 'capped' ? wod.capSeconds ?? 0 : Number(entry.value) || 0, tieBreak: entry.status === 'capped' ? Number(entry.reps) : undefined, submittedAt: new Date().toISOString() }
    setState((current) => {
      const scores = [...current.scores.filter((candidate) => !(candidate.wodId === wod.id && candidate.teamId === teamId)), score]
      const assigned = heat.laneTeamIds.filter((id): id is string => Boolean(id))
      const isComplete = assigned.length > 0 && assigned.every((id) => scores.some((candidate) => candidate.wodId === wod.id && candidate.teamId === id))
      return { ...current, scores, heats: current.heats.map((candidate) => candidate.id === heat.id ? { ...candidate, status: isComplete ? 'complete' : 'ready' } : candidate) }
    })
    setEditingTeams((current) => ({ ...current, [teamId]: false }))
    setJustPublished(teamId)
    window.setTimeout(() => setJustPublished((current) => current === teamId ? null : current), 2200)
  }
  const onlineCount = heat.laneTeamIds.filter((teamId) => teamId && existing(teamId)).length
  const assignedCount = heat.laneTeamIds.filter(Boolean).length
  return <><div className="heat-banner"><div><small>Heat {heat.number} · {scoreLabels[wod.type]}{wod.type === 'for-time' && wod.capSeconds ? ` · ${wod.capSeconds / 60} min cap` : ''}</small><h2>{wod.name}</h2><p>{wod.description}</p></div><span className={onlineCount === assignedCount && assignedCount > 0 ? 'complete' : ''}>{onlineCount}/{assignedCount} scores online</span></div><div className="lane-grid">{heat.laneTeamIds.map((teamId, lane) => {
    const team = state.teams.find((candidate) => candidate.id === teamId)
    const entry = teamId ? entries[teamId] ?? { value: '', reps: '', status: 'scored' as ScoreStatus } : null
    const options = state.teams.filter((candidate) => candidate.id === teamId || (candidate.active && !assignedElsewhere.includes(candidate.id) && !heat.laneTeamIds.includes(candidate.id) && !state.scores.some((score) => score.wodId === wod.id && score.teamId === candidate.id)))
    const statuses: ScoreStatus[] = wod.type === 'for-time' ? ['scored', 'capped', 'dns'] : ['scored', 'dns']
    const savedScore = teamId ? existing(teamId) : undefined
    const isEditing = teamId ? !savedScore || editingTeams[teamId] : false
    return <section className={`lane ${justPublished === teamId ? 'just-published' : ''}`} key={lane}><div className="lane-number"><span>Lane</span><b>{lane + 1}</b></div><label className="team-select">Team<select value={teamId ?? ''} disabled={Boolean(savedScore)} onChange={(e) => assign(lane, e.target.value)}><option value="">Open lane</option>{options.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>{team && entry ? <>{savedScore && !isEditing ? <div className="online-score"><span className="online-badge"><Check /> Online</span><small>Published result</small><strong>{formatScore(savedScore, wod)}</strong><p>{team.participants.map((participant) => participant.name).join(' · ')}</p>{justPublished === team.id && <div className="publish-feedback"><ShieldCheck /> Score is live on the leaderboard</div>}<button className="edit-score" onClick={() => beginEdit(team.id)}><Pencil /> Edit score</button></div> : <div className="score-entry"><div className="athlete-names">{team.participants.map((p) => <span key={p.id}>{p.name}</span>)}</div>{entry.status === 'capped' ? <label>Reps completed<input inputMode="numeric" min="0" type="number" value={entry.reps} onChange={(e) => setEntries((current) => ({ ...current, [team.id]: { ...current[team.id], reps: e.target.value } }))} placeholder="Completed reps" /></label> : <label>Result<input inputMode="numeric" disabled={entry.status !== 'scored'} value={entry.value} onChange={(e) => setEntries((current) => ({ ...current, [team.id]: { ...current[team.id], value: e.target.value } }))} placeholder={wod.type === 'for-time' ? 'Seconds, e.g. 438' : wod.type === 'max-load' ? 'Kilograms' : 'Total reps'} /></label>}<div className={`status-switch status-count-${statuses.length}`}>{statuses.map((status) => <button className={entry.status === status ? 'active' : ''} key={status} onClick={() => setEntries((current) => ({ ...current, [team.id]: { ...current[team.id], status } }))}>{status === 'scored' ? wod.type === 'for-time' ? 'Finished' : 'Valid result' : status === 'capped' ? 'Not finished at cap' : 'Did not start'}</button>)}</div><div className="lane-submit">{savedScore && <button className="cancel-score-edit" onClick={() => cancelEdit(team.id)}>Cancel</button>}<button className="primary" disabled={!entryIsValid(entry)} onClick={() => submitTeam(team.id)}>{savedScore ? 'Update score' : 'Publish score'} <ChevronRight /></button></div></div>}</> : <div className="open-lane"><Plus /><span>Assign a team</span></div>}</section>
  })}</div></>
}

function DivisionBadge({ team }: { team: Pick<Team, 'gender' | 'category'> }) {
  return <span className="division-badges"><i className={`gender-${team.gender}`}>{genderLabels[team.gender]}</i><i className={`category-${team.category}`}>{categoryLabels[team.category]}</i></span>
}

function LeaderboardView({ state }: { state: CompetitionState }) {
  const [event, setEvent] = useState('overall')
  const [gender, setGender] = useState<TeamGender>('mixed')
  const [category, setCategory] = useState<TeamCategory>('open')
  const overall = buildLeaderboard(state)
  const selectedWod = state.wods.find((wod) => wod.id === event)
  const divisionTeams = overall.filter((team) => team.gender === gender && team.category === category)
  const divisionIds = new Set(divisionTeams.map((team) => team.id))
  const rows = selectedWod ? [...state.scores].filter((score) => score.wodId === event && divisionIds.has(score.teamId)).sort((a, b) => (overall.find((team) => team.id === a.teamId)?.wodResults[event]?.place ?? 999) - (overall.find((team) => team.id === b.teamId)?.wodResults[event]?.place ?? 999)) : []
  return <div className="leaderboard-page"><div className="board-masthead"><div className="board-logo"><b>CF</b><strong>100</strong><span>OPEN<br />DAY</span></div><div><span className="live-dot" /> LIVE STANDINGS</div></div><div className="board-content"><div className="board-title"><div><small>{state.competition.name} · {state.competition.location}</small><h1>{event === 'overall' ? 'Overall leaderboard' : selectedWod?.name}</h1><div className="active-division"><DivisionBadge team={{ gender, category }} /><span>{divisionTeams.length} teams</span></div></div><label>View<select value={event} onChange={(e) => setEvent(e.target.value)}><option value="overall">Overall</option>{state.wods.map((wod) => <option key={wod.id} value={wod.id}>{wod.name}</option>)}</select></label></div><section className="division-filter" aria-label="Leaderboard division"><div><small>Team type</small>{(Object.keys(genderLabels) as TeamGender[]).map((value) => <button className={gender === value ? 'active' : ''} key={value} onClick={() => setGender(value)}>{genderLabels[value]}</button>)}</div><div><small>Category</small>{(Object.keys(categoryLabels) as TeamCategory[]).map((value) => <button className={category === value ? 'active' : ''} key={value} onClick={() => setCategory(value)}>{categoryLabels[value]}</button>)}</div></section>{event === 'overall' ? <div className="board-table"><div className="board-row board-head"><span>Rank</span><span>Team</span><span>WOD results</span><span>Points</span></div>{divisionTeams.map((team) => <div className="board-row" key={team.id}><b className="rank">{team.position.toString().padStart(2, '0')}</b><span className="board-team"><strong>{team.name}</strong><DivisionBadge team={team} /><small>{team.participants.map((p) => p.name).join(' + ')}</small></span><span className="event-dots">{state.wods.map((wod) => <i key={wod.id} className={team.wodResults[wod.id] ? 'scored' : ''}>{team.wodResults[wod.id]?.place ?? '·'}</i>)}</span><strong className="points">{team.totalPoints}<small> pts</small></strong></div>)}</div> : <div className="board-table"><div className="board-row board-head"><span>Rank</span><span>Team</span><span>Result</span><span>Points</span></div>{rows.map((score) => { const team = state.teams.find((candidate) => candidate.id === score.teamId), result = overall.find((candidate) => candidate.id === score.teamId)?.wodResults[event]; return <div className="board-row" key={score.id}><b className="rank">{(result?.place ?? 0).toString().padStart(2, '0')}</b><span className="board-team"><strong>{team?.name}</strong>{team && <DivisionBadge team={team} />}<small>{team?.participants.map((p) => p.name).join(' + ')}</small></span><strong>{selectedWod && formatScore(score, selectedWod)}</strong><strong className="points">{result?.points ?? 0}<small> pts</small></strong></div> })}</div>}</div></div>
}

function SettingsView({ state, setState, reset }: StateProps & { reset: () => void }) {
  const [copied, setCopied] = useState(false)
  const publicUrl = state.competition.publicSlug ? `${window.location.origin}/leaderboard?event=${state.competition.publicSlug}` : ''
  async function copyPublicUrl() { await navigator.clipboard.writeText(publicUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  return <div className="page settings-page"><PageHeading eyebrow="Competition" title="Event settings" /><section className="settings-form panel"><label>Competition name<input value={state.competition.name} onChange={(e) => setState((current) => ({ ...current, competition: { ...current.competition, name: e.target.value } }))} /></label><label>Location<input value={state.competition.location} onChange={(e) => setState((current) => ({ ...current, competition: { ...current.competition, location: e.target.value } }))} /></label><label>Date<input type="date" value={state.competition.date} onChange={(e) => setState((current) => ({ ...current, competition: { ...current.competition, date: e.target.value } }))} /></label><label>Status<select value={state.competition.status} onChange={(e) => setState((current) => ({ ...current, competition: { ...current.competition, status: e.target.value as CompetitionState['competition']['status'] } }))}><option value="draft">Draft</option><option value="live">Live</option><option value="complete">Complete</option></select></label></section>{publicUrl && <section className="public-share panel"><div><small>Audience link</small><h2>Public leaderboard</h2><p>Set the event to Live, then share this read-only link. Scores refresh automatically.</p></div><div className="share-row"><input readOnly value={publicUrl} aria-label="Public leaderboard URL" /><button className="secondary" onClick={() => void copyPublicUrl()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy link'}</button></div></section>}<section className="danger-zone"><div><h2>Reset demonstration data</h2><p>Restores sample teams, WODs, heats, and scores on this device.</p></div><button className="danger" onClick={reset}><RotateCcw /> Reset data</button></section></div>
}
function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div className="empty-state"><Dumbbell /><h2>{title}</h2><p>{body}</p>{action}</div> }

export default App
