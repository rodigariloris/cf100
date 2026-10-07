import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.CF100_PASSWORD
const email = 'cf100@cf100.app'

if (!url || !serviceKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CF100_PASSWORD.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: usersResult, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError

const otherUsers = usersResult.users.filter((user) => user.email !== email)
if (otherUsers.length) {
  console.error(`Refusing to continue: ${otherUsers.length} other authentication user(s) exist. Remove them in Supabase Authentication first.`)
  process.exit(1)
}

const existing = usersResult.users.find((user) => user.email === email)
const result = existing
  ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { username: 'cf100' } })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: 'cf100' } })

if (result.error) throw result.error
console.log(existing ? 'CF100 staff password updated.' : 'CF100 staff user created.')
