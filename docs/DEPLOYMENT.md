# Deploying 𝒾Pastor

The platform is one Next.js application backed by **one PostgreSQL database**.
Anywhere that can run a Node process and reach Postgres can host it.

---

## Choosing a host

The platform needs a **running server process and a PostgreSQL database**. That
rules out static hosts — GitHub Pages, Netlify's static tier, S3 — because every
security guarantee here is enforced server-side.

| Host | Database | Good for | Trade-off |
|---|---|---|---|
| **Render** | Managed Postgres, one click | **Most deployments.** One blueprint creates everything | ~$13/month; free tier cold-starts |
| Railway | Add a Postgres service | Quick experiments | Usage-based billing is harder to predict |
| Fly.io | `fly postgres create` | Multi-region, low latency | More command-line work |
| Vercel | External Postgres required | Teams already on Vercel | Serverless weakens the realtime layer |
| Your own VPS | You install it | Full control, data residency | You own patching, backups and TLS |

**Pick Render unless you have a specific reason not to.** It is the only option
where one file creates both the application and its database, already wired
together, with migrations applied on deploy.

If the organisation has a data-residency requirement — counselling records must
stay in a particular country — check the host's regions before committing.
Render's `region:` is set to `frankfurt` in `render.yaml`; change it if needed.

---

## What you need

| Requirement | Notes |
|---|---|
| PostgreSQL 16 | One database. Managed Postgres from any provider is fine. |
| Node 20+ | Or use the included Docker image. |
| A domain | With TLS. Sessions use `__Host-` cookies, which require HTTPS. |
| An email provider | Optional to start, but account verification cannot complete without it. |

---

## The four required environment variables

```bash
DATABASE_URL="postgresql://user:password@host:5432/ipastor?schema=public&sslmode=require"
AUTH_SECRET="$(openssl rand -base64 48)"
DATA_ENCRYPTION_KEY="$(openssl rand -base64 48)"
NEXT_PUBLIC_APP_URL="https://your-domain.example.org"
```

**`DATA_ENCRYPTION_KEY` deserves a moment's care.** It encrypts counselling
notes and safeguarding narratives. Lose it and that content is unrecoverable —
there is no reset, by design. Store it in your host's secret manager *and* keep
an offline copy somewhere separate from the database backup. Never rotate it
without first re-encrypting existing rows.

Everything else in `.env.example` is optional. Where an integration is absent,
the platform reports it honestly as *not configured* in the admin system
monitor rather than pretending it works.

---

## Option 1 — Docker (simplest, includes the database)

```bash
export AUTH_SECRET="$(openssl rand -base64 48)"
export DATA_ENCRYPTION_KEY="$(openssl rand -base64 48)"
export NEXT_PUBLIC_APP_URL="https://your-domain.example.org"

docker compose up --build -d
```

The container applies outstanding migrations at start, so the schema and the
running code never drift apart. Add `SEED_ON_START=true` once to load
demonstration data.

Put a TLS-terminating reverse proxy (Caddy, nginx, your host's load balancer) in
front of port 3000.

---

## Option 2 — Render (recommended)

**[docs/RENDER.md](RENDER.md) is a full step-by-step walkthrough**, including
DNS, email and first-run setup.

The short version: **New → Blueprint**, point it at the repository, and Render
reads `render.yaml` to create the web service and a managed Postgres with
`DATABASE_URL` wired between them.

`AUTH_SECRET` and `DATA_ENCRYPTION_KEY` are generated on first deploy — copy the
encryption key somewhere safe immediately.

---

## Option 3 — Railway

1. **New Project → Deploy from GitHub repo.**
2. Add a **PostgreSQL** service; Railway injects `DATABASE_URL`.
3. Set `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` and `NEXT_PUBLIC_APP_URL`.
4. Railway reads `railway.json` and builds from the Dockerfile.
5. Add your domain under **Settings → Networking**.

---

## Option 4 — Fly.io

```bash
fly launch --no-deploy
fly postgres create --name ipastor-db
fly postgres attach ipastor-db
fly secrets set AUTH_SECRET="$(openssl rand -base64 48)"
fly secrets set DATA_ENCRYPTION_KEY="$(openssl rand -base64 48)"
fly secrets set NEXT_PUBLIC_APP_URL="https://your-domain.example.org"
fly deploy
fly certs add your-domain.example.org
```

---

## Option 5 — Vercel

Vercel needs an external Postgres (Neon, Supabase, RDS — any of them).

1. Import the repository.
2. Set the four required variables.
3. `vercel.json` runs `prisma migrate deploy` as part of the build.
4. Add your domain under **Settings → Domains**.

Two things to know. The realtime hub is in-process, so on Vercel's serverless
runtime Server-Sent Events work per-instance; for reliable realtime across
instances, run the app as a long-lived process (Docker, Render, Railway, Fly)
or point the adapter at a shared broker. And set the function region close to
your database.

---

## Pointing your domain at it

1. Add the domain in your host's dashboard.
2. Create the DNS record it asks for:
   - Apex domain → `A` record to the host's IP, or `ALIAS`/`ANAME` if offered.
   - Subdomain → `CNAME` to the host's target.
3. Wait for the certificate to issue (usually minutes).
4. **Set `NEXT_PUBLIC_APP_URL` to exactly that origin** and redeploy. Email
   links, the PWA manifest and the same-origin check all read it, so a mismatch
   shows up as broken verification links.
5. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` to the same origin before
   building the mobile apps.

---

## First run after deploying

```bash
# Apply the schema (the Docker image does this automatically)
npm run db:deploy

# Optional: demonstration data
npm run db:seed
```

Then:

1. Open `/api/health` — it should report `ok` with the database `online`.
2. Sign in as the Setman account.
3. Open **Super Admin → Church Hierarchy** and confirm or replace the
   provisional leadership records.
4. Open **Privacy & Security** and enrol multi-factor authentication. Until you
   do, every sensitive action stays blocked — including hierarchy changes.
5. Create the real administrators, and remove the demo accounts.

---

## Backups

Set `BACKUP_SCHEDULE` so the admin system monitor reports backups as
configured, then set up the backup itself:

```bash
# Nightly, encrypted, retained 30 days
pg_dump "$DATABASE_URL" --format=custom --no-owner \
  | gpg --encrypt --recipient backups@your-domain.example.org \
  > "ipastor-$(date +%F).dump.gpg"
```

Most managed Postgres providers do this for you — enable it, and set the
retention period.

**Test a restore.** A backup nobody has restored is a hypothesis, not a backup:

```bash
gpg --decrypt ipastor-2026-01-01.dump.gpg \
  | pg_restore --dbname "$RESTORE_TEST_URL" --clean --if-exists
```

Back up `DATA_ENCRYPTION_KEY` separately from the database. A backup restored
without it yields rows of unreadable ciphertext.

---

## Staging

Never point development or staging at the production database.

```bash
createdb ipastor_staging
DATABASE_URL="postgresql://…/ipastor_staging" npm run db:deploy
DATABASE_URL="postgresql://…/ipastor_staging" npm run db:seed
```

Use different secrets per environment. Staging with production secrets is
production with extra steps.

---

## Monitoring

`/api/health` returns `200` when healthy and `503` when the database is
unreachable, so a load balancer stops routing to an instance that cannot serve
anyone. It reports per-service state, database latency and realtime subscriber
count.

Inside the platform, **Admin → Security** and **Super Admin → System Overview**
show live service state, failed sign-ins, permission denials and session
activity.

---

## Going live

- [ ] Every demo account changed or removed
- [ ] Policy pages reviewed by legal and privacy advisers
- [ ] Leadership hierarchy confirmed with the organisation
- [ ] `DATA_ENCRYPTION_KEY` backed up separately from the database
- [ ] Email provider configured and a verification email delivered end to end
- [ ] Automated backups enabled **and a restore tested**
- [ ] MFA enrolled on every administrative account
- [ ] Safeguarding escalation procedure completed and leads named
- [ ] Emergency controls understood by whoever holds the Setman account
- [ ] `NEXT_PUBLIC_APP_URL` matches the live domain exactly
