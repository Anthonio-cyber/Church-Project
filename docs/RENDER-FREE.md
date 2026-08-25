# Deploying 𝒾Pastor for free, at ipastor.onrender.com

A £0/month path to a real, shareable link today. Use this to preview and share
the platform now; move to [`docs/RENDER.md`](./RENDER.md) (paid plan, a real
custom domain) once real members are relying on it — nothing about the code
changes, only the hosting plan.

Allow about 20 minutes.

---

## What "free" actually costs you

Being upfront about this before you start:

- **The web service sleeps after ~15 minutes with no visitors.** The next
  person to open the link waits roughly 30–50 seconds while it wakes up. Fine
  for a preview you're sending to a few people to look at; not fine as the
  front door of a pastoral-care platform once people are relying on it to
  respond when they reach out.
- **Render's own free Postgres expires and is deleted after 30 days.** So this
  path uses [Neon](https://neon.tech) instead — a separate free Postgres host
  with no expiry and no card required. One extra account, but it means your
  data doesn't vanish on you a month in.
- **The `.onrender.com` subdomain isn't guaranteed to be `ipastor`.** That
  name is shared across every Render user; if someone else already has it,
  Render assigns a variant and you'll adjust one setting to match (Step 3
  covers this).

---

## Before you start

1. **A Neon account** — <https://neon.tech>, free, no card. Sign in with
   GitHub or email.
2. **A Render account** — <https://render.com>, free. Sign in with GitHub so
   it can see the repository.

---

## Step 1 — Create the free database on Neon

1. Neon dashboard → **New Project**.
2. Name it `ipastor` (or anything), pick any region — Frankfurt if you want it
   close to Render's `frankfurt` region for lower latency.
3. Once it's created, Neon shows a **Connection string** on the project
   dashboard. It looks like:

   ```
   postgresql://neondb_owner:AbC123@ep-cool-shape-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **Copy it.** You'll paste it into Render in Step 2.

Neon's free tier includes a small compute allowance and pauses the database
after inactivity too — it wakes automatically on the next query, adding a
little to that first-request delay alongside the web service waking up. For a
preview link, that's a one-time couple of seconds most visitors won't notice.

---

## Step 2 — Create the web service on Render

1. Render dashboard → **New** → **Blueprint**.
2. Connect GitHub if prompted, then choose **Anthonio-cyber/Church-Project**.
3. Render looks for `render.yaml` at the repo root by default. This repo has
   two blueprints — `render.yaml` (the paid path) and `render-free.yaml` (this
   one) — so if Render's flow offers a **blueprint file path** field, enter
   `render-free.yaml`. If your account's Blueprint flow doesn't show that
   option, use the **manual path** below instead — it creates the identical
   service by hand.
4. Render shows what it will create: one Docker web service named `ipastor`
   on the **Free** plan. It asks for the values marked `sync: false`:
   - `DATABASE_URL` → paste the Neon connection string from Step 1.
   - Leave `EMAIL_API_KEY` and the other optional integration keys blank.
5. **Apply.**

<details>
<summary>Manual path, if Blueprint doesn't offer a custom file</summary>

1. Render dashboard → **New** → **Web Service**.
2. Connect **Anthonio-cyber/Church-Project**.
3. **Runtime:** Docker. **Dockerfile path:** `./Dockerfile`. **Branch:**
   `claude/keen-gauss-dkx2c6`.
4. **Instance type:** Free.
5. **Environment** → add each variable:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `AUTH_SECRET` | click **Generate** |
   | `DATA_ENCRYPTION_KEY` | click **Generate** |
   | `NEXT_PUBLIC_APP_URL` | `https://ipastor.onrender.com` (fix in Step 3 if Render assigned a different name) |
   | `NEXT_PUBLIC_BRAND_NAME` | `iPastor` |
   | `NODE_ENV` | `production` |
   | `SEED_ON_START` | `false` |

6. **Health check path:** `/api/health`.
7. **Create Web Service.**

</details>

Render now builds the Docker image. The first build takes 5–10 minutes.

### Do this immediately after the first deploy

**Environment → `DATA_ENCRYPTION_KEY` → reveal → copy it somewhere safe.**
That key encrypts counselling notes and safeguarding narratives. If this
preview later becomes the real thing rather than getting rebuilt from
scratch, losing that key makes that content permanently unreadable — there is
no reset, by design.

---

## Step 3 — Check it is alive, and confirm the real URL

Render shows the service's URL at the top of its dashboard page — it's
`https://ipastor.onrender.com` if that name was free, or something like
`https://ipastor-a1b2.onrender.com` if it wasn't.

Open `<that URL>/api/health`. You should see:

```json
{
  "status": "ok",
  "services": { "database": "online", "authentication": "online", … }
}
```

`"email": "not_configured"` is expected and is the platform being honest, not
broken — there's no email provider wired up on this free path.

If the assigned URL isn't exactly `ipastor.onrender.com`: **Environment** →
update `NEXT_PUBLIC_APP_URL` to match it exactly (no trailing slash) → save.
This triggers a redeploy. Skipping this makes sign-up email links and the PWA
manifest point at the wrong address.

If `status` is `degraded`, the database isn't reachable — check **Logs**, and
confirm the Neon connection string was pasted in full, including
`?sslmode=require`.

---

## Step 4 — Create the Super Admin account

The seed script creates no fictional people or content — only the permission
catalogue, the roles, and one real Super Admin account so someone can sign in.

**Environment** → add `SEED_ON_START` = `true` → save → wait for the redeploy
→ then **set it back to `false`**. Leaving it on re-runs the seed script on
every future deploy, which fails the second time since the account already
exists.

By default this creates:

| Role | Email | Password |
|---|---|---|
| Super Admin | `tony@rcnglobal.com` | `Tony1234` |

Override it by setting `SEED_SUPER_ADMIN_EMAIL` and
`SEED_SUPER_ADMIN_PASSWORD` in **Environment** before the seed runs.

Sign in at `<your URL>/login`, then **immediately**:

1. **Privacy & Security → change the password** — this one's deliberately
   temporary.
2. **Privacy & Security → Multi-factor authentication → set up.** Every
   sensitive action is blocked until you do.
3. **Super Admin → Church Hierarchy** and **Administrators** — build the real
   structure; nothing is pre-populated.

---

## Moving to the paid path later

When you're ready for `ipastor.com` (or whichever domain), always-on
response times, and a database that isn't on a shared free tier:

1. Register the domain.
2. Follow `docs/RENDER.md` — it creates a **separate** paid web service and a
   Render-managed database, wired via `render.yaml`.
3. Once the paid service is confirmed working and DNS has cut over, delete
   this free service and the Neon project (or keep Neon as a cheap staging
   database — its paid tier is inexpensive if you'd rather not migrate data).

Nothing about the application code changes between the two paths — only which
`render.yaml`-shaped file you deployed and which plan it's running on.

---

## If something goes wrong

Same failure modes as the paid path — see the **If something goes wrong**
section at the bottom of `docs/RENDER.md`. The one free-path-specific one:

**First request after a while is very slow, then fine.** Expected — the free
web service and the Neon database both suspend when idle and wake on the
next request. Not a bug; the tradeoff that makes this free.
