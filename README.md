# Standard Projects CRM

A sales CRM for a small team: reps get a ranked to-do list and type as little as possible, while the owner sees the whole team.

## Run it locally

```bash
npm install
cp .env.example .env      # then set SYNC_INGEST_SECRET to a long random string
npm run setup             # creates the SQLite database with you as the only user (Owner)
npm run dev               # http://localhost:3000
```

Sign in by picking a person on `/login`. **This is a development-only sign-in with no password; replace it before going live.**

The starting owner is set by `OWNER_NAME` / `OWNER_EMAIL` in `.env`. As owner, go to **Settings** to create teams and add people with a role:

- **Owner**: sees and manages everything, including Settings.
- **Team lead**: sees their team's leads plus unassigned ones, assigns leads and sets goals within the team.
- **Sales rep**: sees only their own leads.

Removing someone sends their open leads back to the unassigned pool and keeps their logged history. The CRM always keeps at least one owner.

Want to try it with fictional people and companies? Run `npm run db:demo`. `npm run db:seed` resets to just the owner. **Both wipe the database.**

## MVP features

| Feature | Where | How it works |
|---|---|---|
| **Ranked Today queue** | `/today` | Due follow-ups sorted by: replies waiting on you → deal stage → deal size (monthly × 12) → days overdue. Each item explains *why* it's there. Leads with 6 unanswered touches move to "Needs a decision" (try again in 30 days / close as lost). Logic: `src/lib/queue.ts`. |
| **Automatic stages & follow-ups** | everywhere you log | Logging an activity moves the stage forward (email/call → Contacted, meeting → Meeting booked, proposal → Proposal sent, "not interested" → Lost) and schedules the next follow-up from the cadence (Contacted 14 days, Proposal 7 days, day after a meeting). Replies reset the unanswered counter. Stages never move backwards. Logic: `src/lib/stageRules.ts`. |
| **Quick log (phone-first)** | `/log`, Today, each lead | Tap: who → what happened → outcome → follow-up. Only a call needs an outcome; everything else is optional. |
| **Three access levels** | all pages and actions | Owner sees everything. Team lead sees their team + unassigned leads and can assign within the team. Rep sees only their own leads. Enforced on the server for every read and write. Logic: `src/lib/access.ts`. |
| **Team dashboard** | `/team` | Weekly calls/emails/meetings per rep, goals with progress bars (managers set them inline), leaderboard by % of goals, pipeline by stage, stalled deals (no contact in 14+ days), unassigned count. |
| **Gmail & Calendar auto-capture (receiving end)** | `POST /api/sync/ingest` | Takes a user's emails and calendar events, matches each to a lead (exact address, then company domain from the lead's email or website; free-mail and ambiguous domains are never guessed), logs them as activities and applies the stage rules. Safe to re-send: duplicates are skipped by message/event id. |

### Website enquiries and the quote form

- **Existing website form:** a database trigger copies every new row in `public.inquiries` (the standardprojects.org contact form) into an unassigned **New** lead, due now, with the message logged as a note (`prisma/migrations/0002_website_inquiries`).
- **Get a quote:** `/quote` is a public 4-step questionnaire in English and Thai (services → business → budget and timing → contact, with LINE as a contact option). Each request becomes an unassigned lead tagged "Quote request", with every answer in a note and the budget (in baht) used as an estimated value so it ranks properly in Today. If the email matches an existing lead, the request is added to that lead instead. It has spam protection (a hidden honeypot field and 5 requests per hour per IP).
  - Link to it: `https://standard-projects-crm.vercel.app/quote`
  - Or embed it: `<iframe src="https://standard-projects-crm.vercel.app/quote?embed=1" style="width:100%;height:760px;border:0"></iframe>`

### Sync endpoint

```bash
curl -X POST http://localhost:3000/api/sync/ingest \
  -H "Authorization: Bearer $SYNC_INGEST_SECRET" -H "content-type: application/json" \
  -d '{"userEmail":"rep@example.com","items":[
        {"kind":"email","externalId":"<gmail id>","direction":"in","from":"tom@client.co.uk","to":["rep@example.com"],"subject":"Re: quote","occurredAt":"2026-10-19T15:00:00Z"},
        {"kind":"event","externalId":"<event id>","title":"Discovery call","attendees":["tom@client.co.uk"],"start":"2026-10-22T10:00:00Z"}]}'
```

## Not built yet

- **Google connection.** The piece that signs each person in with Google and pulls their Gmail and Calendar into the sync endpoint above. It needs a Google Cloud OAuth client (Gmail read-only and Calendar read-only scopes).
- **Real authentication** to replace the dev sign-in.
- **Production database.** Change `provider` in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at Postgres or Supabase.
- Ported from Leoda: Projects, mail merge, team calendar view, bot.
- Later phase: forecasting, round-robin assignment, call recording, AI summaries.

## Scripts

`npm test` (unit tests for the rules) · `npm run lint` · `npm run build` · `npm run db:seed` (reset to just the owner) · `npm run db:demo` (fictional demo data)
