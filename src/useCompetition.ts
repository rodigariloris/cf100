import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { initialState } from './data'
import { createCompetition, loadCompetition, saveCompetition } from './remote'
import { supabase, supabaseConfigured } from './supabase'
import type { CompetitionState } from './types'

const STORAGE_KEY = 'cf100-competition-v1'
const SESSION_DEADLINE_KEY = 'cf100-session-deadline'
const SESSION_LENGTH_MS = 3 * 60 * 60 * 1000
const publicSlug = new URLSearchParams(window.location.search).get('event')

function loadLocalState() {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) as CompetitionState : initialState }
  catch { return initialState }
}

export function useCompetition() {
  const [state, setState] = useState<CompetitionState>(loadLocalState)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'local' | 'saving' | 'saved' | 'error'>(supabaseConfigured ? 'saved' : 'local')
  const [error, setError] = useState('')
  const suppressSave = useRef(true)
  const readOnly = Boolean(publicSlug)

  async function hydrate(id: string, bySlug = false) {
    try { const remote = await loadCompetition(id, bySlug); suppressSave.current = true; setState(remote); setNeedsSetup(false); setError('') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load competition') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!supabase) return
    if (publicSlug) { void hydrate(publicSlug, true); return }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || publicSlug || !session) { if (supabaseConfigured && !publicSlug && !session) setLoading(false); return }
    setLoading(true)
    void supabase.from('staff_members').select('competition_id').eq('user_id', session.user.id).limit(1).maybeSingle().then(({ data, error: membershipError }) => {
      if (membershipError) { setError(membershipError.message); setLoading(false) }
      else if (!data) { setNeedsSetup(true); setLoading(false) }
      else void hydrate(data.competition_id)
    })
  }, [session])

  useEffect(() => {
    if (!supabase || !session || readOnly) return
    const client = supabase
    let deadline = Number(localStorage.getItem(SESSION_DEADLINE_KEY))
    if (!deadline) {
      deadline = Date.now() + SESSION_LENGTH_MS
      localStorage.setItem(SESSION_DEADLINE_KEY, String(deadline))
    }
    const expire = () => { localStorage.removeItem(SESSION_DEADLINE_KEY); void client.auth.signOut() }
    if (deadline <= Date.now()) { expire(); return }
    const timer = window.setTimeout(expire, deadline - Date.now())
    return () => window.clearTimeout(timer)
  }, [session, readOnly])

  useEffect(() => {
    if (!supabaseConfigured) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return }
    if (readOnly || !session || !state.competition.id || needsSetup) return
    if (suppressSave.current) { suppressSave.current = false; return }
    setSyncStatus('saving')
    const timer = window.setTimeout(() => { void saveCompetition(state).then(() => { setSyncStatus('saved'); setError('') }).catch((caught) => { setSyncStatus('error'); setError(caught instanceof Error ? caught.message : 'Save failed') }) }, 650)
    return () => window.clearTimeout(timer)
  }, [state, session, needsSetup, readOnly])

  useEffect(() => {
    if (!supabase || !readOnly || !state.competition.id) return
    const client = supabase
    const channel = client.channel(`scores:${state.competition.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => void hydrate(state.competition.id!)).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [readOnly, state.competition.id])

  const signIn = async (email: string, password: string) => { if (!supabase) return 'Supabase is not configured'; const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); if (!signInError) localStorage.setItem(SESSION_DEADLINE_KEY, String(Date.now() + SESSION_LENGTH_MS)); return signInError ? 'Invalid email or password' : '' }
  const signOut = async () => { localStorage.removeItem(SESSION_DEADLINE_KEY); await supabase?.auth.signOut() }
  const setupCompetition = async (name: string, date: string, location: string) => { const id = await createCompetition(name, date, location); await hydrate(id) }
  const reset = () => { localStorage.removeItem(STORAGE_KEY); setState(initialState) }
  return { state, setState, reset, session, loading, needsSetup, syncStatus, error, readOnly, remoteConfigured: supabaseConfigured, signIn, signOut, setupCompetition }
}
