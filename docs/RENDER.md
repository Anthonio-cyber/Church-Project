# Deploying 𝒾Pastor to Render at ipastor.church

A step-by-step walkthrough. Allow about 40 minutes, most of it waiting for the
first build and for DNS.

---

## Before you start

You need three things:

1. **The domain `ipastor.church`**, registered and with access to its DNS
   settings. It was unregistered when this was written — register it before you
   start, at Namecheap, Porkbun, Cloudflare Registrar or any registrar that
   sells `.church` (roughly £25–35 a year; it is a sponsored TLD, so it costs
   more than `.org`).

   If you end up on a different domain, substitute it everywhere below and in
   `render.yaml`, `.env.example` and `apps/mobile/eas.json`.
2. **A Render account** — <https://render.com>, free to create. Sign in with
   GitHub so it can see the repository.
3. **PR #1 merged to `main`**, or change `branch:` in `render.yaml` to
   `claude/keen-gauss-dkx2c6` if you want to deploy before merging.

---

## Step 1 — Create the services

1. Render dashboard → **New** → **Blueprint**.
2. Connect GitHub if prompted, then choose **Anthonio-cyber/Church-Project**.
3. Render finds `render.yaml` and shows what it will create:
   - `ipastor` — a Docker web service
   - `ipastor-db` — a managed PostgreSQL 16 database
4. It will ask for the values marked `sync: false`. Leave the optional
   integration keys blank for now; you can add them later.
5. **Apply**.

Render now builds the Docker image. The first build takes 5–10 minutes.

### What happens automatically

- `DATABASE_URL` is wired from the database to the web service.
- `AUTH_SECRET` and `DATA_ENCRYPTION_KEY` are generated.
- On container start, `docker-entrypoint.sh` runs `prisma migrate deploy`, so
  the schema is created before the app serves anything.

### Do this immediately after the first deploy

**Environment → `DATA_ENCRYPTION_KEY` → reveal → copy it somewhere safe**, in a
password manager or offline, separate from your database backups.

That key encrypts counselling notes and safeguarding narratives. If you lose it,
that content is unrecoverable — there is no reset, by design. A database backup
restored without the key is rows of unreadable ciphertext.

---

## Step 2 — Check it is alive

Render gives you a temporary URL like `https://ipastor.onrender.com`.

Open `https://ipastor.onrender.com/api/health`. You should see:

```json
{
  "status": "ok",
  "services": { "database": "online", "authentication": "online", … }
}
```

`"email": "not_configured"` is expected at this point and is the platform being
honest, not broken.

If `status` is `degraded`, the database is not reachable — check the
**Logs** tab.

---

## Step 3 — Point ipastor.church at it

**In Render:** service → **Settings** → **Custom Domains** → **Add Custom
Domain**. Add both:

- `ipastor.church`
- `www.ipastor.church`

Render then shows the DNS records it wants. They look like this:

| Host | Type | Value |
|---|---|---|
| `@` (or blank) | `A` | `216.24.57.1` |
| `www` | `CNAME` | `ipastor.onrender.com` |

**Use the values Render actually shows you**, not these — they change.

**At your registrar:** find **DNS** / **Manage DNS** / **DNS Records**, then add
each record.

The one mistake almost everyone makes: in the **Host** or **Name** field, enter
only `@` or `www` — *not* `ipastor.church` or `www.ipastor.church`. The registrar
appends your domain automatically, so typing the full name gives you
`www.ipastor.church.ipastor.church`.

If your registrar does not support `A` records at the apex, use Cloudflare DNS
(free) which supports `CNAME` flattening, or point the apex at `www` with a
redirect.

**Then wait.** Usually 10–30 minutes; occasionally a few hours. Render shows a
green tick per domain once it verifies and issues the TLS certificate.

---

## Step 4 — Set the app URL

Once the domain is live: **Environment** → confirm

```
NEXT_PUBLIC_APP_URL = https://ipastor.church
```

`render.yaml` already sets this, but check it matches exactly — no trailing
slash, `https` not `http`. Email verification links, the PWA manifest and the
same-origin check all read it, and a mismatch shows up as verification links
that go nowhere.

Changing it triggers a redeploy.

---

## Step 5 — Load demonstration data (optional)

To explore the platform with the demo accounts:

**Environment** → add `SEED_ON_START` = `true` → save → wait for the redeploy →
then **set it back to `false`**. Leaving it on re-runs the seed on every deploy.

Or run it once from **Shell**:

```bash
cd /app/apps/web && npx tsx prisma/seed.ts
```

Sign in at `https://ipastor.church/login` with `setman@example.org` /
`AdminDemo2024!Ministry`.

**Before real members use the platform, remove every demo account.**

---

## Step 6 — Email

Nothing else can complete account verification, so do this before launch.

1. Create a [Resend](https://resend.com) account (or any provider — the adapter
   is provider-agnostic).
2. Verify `ipastor.church` as a sending domain. The provider gives you SPF, DKIM
   and DMARC records — **TXT records**, added at your registrar exactly like
   Step 3.
3. In Render: **Environment** → set `EMAIL_API_KEY`, and confirm
   `EMAIL_FROM = iPastor <no-reply@ipastor.church>`.
4. Register a test account and confirm the email arrives.

---

## Step 7 — First-run setup

1. Sign in as the Setman.
2. **Privacy & Security → Multi-factor authentication → Set up.** Until you do,
   every sensitive action is blocked — hierarchy changes, appointments,
   emergency controls. That is deliberate.
3. **Super Admin → Church Hierarchy.** The Setman, Rev. Tony and
   Pst. Gabriel Adayi records are seeded as *provisional* and are not published
   publicly. Confirm each with the organisation, or remove and replace them.
4. **Super Admin → Administrators.** Appoint the real administrators.
5. **Admin → Users.** Remove the demo accounts.

---

## Step 8 — Backups

Render takes daily backups on paid database plans. Confirm the retention period
under the database's **Backups** tab, and **test a restore** — a backup nobody
has restored is a hypothesis, not a backup.

Set `BACKUP_SCHEDULE` (e.g. `0 3 * * *`) so the admin system monitor reports
backups as configured.

---

## Step 9 — The mobile apps

`apps/mobile` is already pointed at `https://ipastor.church`. When you are ready:

```bash
cd apps/mobile
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Set a real `projectId` in `app.json` under `extra.eas` first. See
`apps/mobile/README.md` for store metadata and the submission checklist.

---

## Costs

| Item | Plan | Approximate |
|---|---|---|
| Web service | Starter | $7/month |
| PostgreSQL | Basic 256MB | $6/month |
| Domain | — | ~$12/year |
| Email (Resend) | Free tier | $0 up to 3,000/month |
| **Total** | | **~$14/month** |

Render's free web tier spins down after inactivity, which means a cold start of
30+ seconds for whoever arrives next. For a platform where someone may be
reaching for counselling, that is worth $7 to avoid.

---

## If something goes wrong

**Build fails.** Check **Logs**. The usual cause is a missing environment
variable — the app refuses to boot in production without `AUTH_SECRET` and
`DATA_ENCRYPTION_KEY` rather than silently using a weak default.

**`/api/health` says `degraded`.** The database is unreachable. Confirm
`DATABASE_URL` is wired from the database, not typed by hand.

**Domain shows a certificate warning.** DNS has not finished propagating, or a
record has the full hostname in the Name field. Re-check Step 3.

**Verification emails do not arrive.** `EMAIL_API_KEY` is unset, or the sending
domain is not verified with your provider. Check **Logs** for
`[mail:not-configured]`.

**Signed in but every admin action is refused.** Working as designed — enrol
multi-factor authentication.
