# CF100 Competition Desk

A staff-only CrossFit competition manager with team and WOD editing, configurable position points, four-lane heat control, per-team score publication, and a live public leaderboard.

## Run without a database

```bash
npm install
npm run dev
```

Without environment variables the app uses browser `localStorage`. This is useful for trying the UI, but data belongs only to that browser.

## Run with the local Supabase database

Docker must be running.

```bash
npm install
npm run backend:start
npm run backend:reset
npm run backend:status
```

Create `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<the anon key printed by npm run backend:status>
```

Then run `npm run dev`.

Create a local staff account in Supabase Studio under **Authentication → Users → Add user**, then sign in with its email and password. On first login, the app asks for the competition details and creates the database workspace automatically. The staff session lasts three hours and survives page refreshes.

Use Studio's **Table Editor** to inspect the data. `backend:reset` deletes local database data and reapplies every migration.

## Free hosted deployment: Supabase + Cloudflare Pages

### 1. Create and populate Supabase

1. Create a free project at <https://supabase.com/dashboard>.
2. Authenticate and connect the CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

3. In **Project Settings → API**, copy the project URL and publishable/anonymous key. Never put the service-role key in the frontend or Cloudflare.
4. In **Authentication → Users → Add user**, create the staff email/password account and confirm it.
5. In **Authentication → Settings**, disable public new-user signups.

### 2. Deploy the frontend on Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In <https://dash.cloudflare.com>, choose **Workers & Pages → Create → Pages → Connect to Git**.
3. Use build command `npm run build` and output directory `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview.
5. Deploy. Cloudflare supplies a `pages.dev` URL and rebuilds after each push.

### 3. First use

1. Open the Cloudflare URL and sign in with the staff email and password created in Supabase.
2. Complete the first-run competition form.
3. Add teams and WODs, then configure points under **WODs**.
4. In **Settings**, change status from **Draft** to **Live**.
5. Copy the **Public leaderboard** link from Settings and share it. It is read-only and refreshes when scores are published.

## Checks and useful commands

```bash
npm run build
npm run lint
npm test
npm run backend:stop
```

The Supabase migrations provide row-level security, staff membership, public read-only live-event access, four lanes per heat, score audit records, and realtime score publication.

Staff pages use paths such as `/teams`, `/wods`, and `/floor`, so refreshing or using the browser back button preserves the current section. Missing or expired authentication redirects to `/login`; successful login returns to the originally requested page.
