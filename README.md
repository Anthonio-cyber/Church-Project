# 𝒾Pastor

A private Christian pastoral counselling, discipleship, fellowship and church
administration platform — web, Android, iOS and tablet, on one secure backend.

Built around a small number of promises, each enforced in code rather than
policy:

- **Consent before contact.** No member can message another without an accepted
  connection request. Before acceptance there is no conversation row to write to.
- **Counselling stays inside its boundary.** A session is visible to the member
  and their assigned counsellor. Internal notes are encrypted at rest and every
  access is recorded. Administrative rank alone opens nothing.
- **Accountable leadership.** Administration follows the church hierarchy with
  least-privilege permissions, and the audit log is append-only at the database
  level — no administrator, including the Setman, can erase their own actions.
- **Honest about limits.** Where something needs professional or emergency help,
  the platform says so plainly instead of implying it can substitute for it.

> **Branding notice.** 𝒾Pastor uses an original golden RCN seal created for this
> platform. It is **not** an official product of Remnant Christian Network, and
> makes no claim of official status, endorsement or affiliation unless and until
> the organisation authorises it in writing. See `apps/web/public/brand/README.md`
> for how to deploy under authorised official branding — it is a one-file swap.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env          # then fill in DATABASE_URL and the two secrets

# 3. Create the schema and load demonstration data
npm run db:deploy
npm run db:seed

# 4. Run
npm run dev                   # http://localhost:3000
```

Generate the two required secrets with `openssl rand -base64 48`.

### With Docker, including the database

```bash
export AUTH_SECRET="$(openssl rand -base64 48)"
export DATA_ENCRYPTION_KEY="$(openssl rand -base64 48)"
docker compose up --build
```

---

## First sign-in

`npm run db:seed` creates no fictional people, churches or content — only the
permission catalogue, the roles built from it, and one real Super Admin
account so someone can sign in and take it from there:

| Role | Email | Password |
|---|---|---|
| Super Admin | `tony@rcnglobal.com` | `Tony1234` |

This is a **temporary** password, meant to be changed within minutes of first
sign-in, not left in place. Override the account created by the seed with
`SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD`.

**Expected behaviour on first sign-in:** the account is seeded with
multi-factor authentication *required but not yet enrolled* — the state a newly
appointed administrator is genuinely in. It can sign in and browse; every
sensitive action stays blocked until it enrols from **Privacy & Security**.
That is the platform working correctly, not a defect.

**Do this immediately after the first sign-in, in order:**

1. **Privacy & Security → change the password.**
2. **Privacy & Security → Multi-factor authentication → set up**, with any
   TOTP app.
3. **Super Admin → Church Hierarchy** — add the real leadership structure.
4. **Super Admin → Administrators** — appoint the real administrators, then
   consider removing or demoting this seed account if it was only meant to
   be a bootstrap step rather than someone's real login.

The **Setman**, **Rev. Tony** and **Pst. Gabriel Adayi** hierarchy records are
seeded as **provisional**: pending approval, flagged as placeholders, and
deliberately *not* published on the public leadership page until the
organisation confirms those people hold those offices.

---

## What is here

```
apps/web/                 Next.js 15 — public site, member app, four staff portals, API
  prisma/                 Schema, migrations, seed
  src/app/(site)/         Public website and policy pages
  src/app/(auth)/         Sign in, register, verification, password reset
  src/app/app/            Authenticated member application
  src/app/counsellor/     Counsellor portal
  src/app/moderation/     Moderator portal
  src/app/admin/          Admin portal
  src/app/super-admin/    Super Admin portal
  src/app/api/            Every API route
  src/lib/                Auth, permissions, crypto, audit, domain logic
  tests/                  Access-control test suite
apps/mobile/              Expo — Android, iOS and tablet
```

### Surfaces

| Surface | Path |
|---|---|
| Public website | `/` |
| Member application | `/app/dashboard` |
| Counsellor portal | `/counsellor` |
| Moderator portal | `/moderation` |
| Admin portal | `/admin` |
| Super Admin portal | `/super-admin` |
| Health check | `/api/health` |

---

## Commands

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # serve the production build
npm run typecheck      # TypeScript, no emit
npm run test           # access-control test suite
npm run db:migrate     # create a migration in development
npm run db:deploy      # apply migrations (production)
npm run db:seed        # load demonstration data
npm run db:reset       # drop, re-migrate and re-seed (destructive)
npm run mobile         # start the Expo mobile app
```

---

## The database

**One PostgreSQL database.** The separation the specification calls for —
between member data, counselling, safeguarding, moderation and audit — is
enforced by schema design, granular permissions and application guards, not by
separate servers. That keeps transactional integrity across boundaries (a
counselling session and its conversation are created atomically) while the
access rules stay strict.

Two things are enforced by the database itself rather than by convention:

- **`audit_logs` is append-only.** A trigger rejects `UPDATE` and `DELETE`. The
  single exception is releasing `actorId` to `NULL` when an account is erased
  under a data-rights obligation — the entry survives, its content unchanged,
  and the denormalised `actorEmail`/`actorRole` keep it meaningful.
- **The access trails are append-only too** — `session_note_access`,
  `safeguarding_access` and `hierarchy_changes`.

A deliberate, recorded purge is still possible, but only by a database superuser
setting `app.audit_maintenance = 'on'` for the transaction, which makes the act
visible in the database logs rather than invisible in the product.

---

## Testing

```bash
npm run test
```

49 tests covering the access-control assertions the specification names:

| Question | Expected | Covered |
|---|---|---|
| Can User A access User B's counselling session? | NO | ✓ |
| Can User A access User B's session notes? | NO | ✓ |
| Can User A message User B without approval? | NO | ✓ |
| Can a normal user become a counsellor by changing frontend data? | NO | ✓ |
| Can a moderator access private counselling notes by default? | NO | ✓ |
| Can a counselling admin read counselling conversations? | NO | ✓ |
| Can an administrator change their own role to Super Admin? | NO | ✓ |
| Can a lower-level administrator change a higher-level one? | NO | ✓ |
| Can the Setman review all administrative actions? | YES, audited | ✓ |
| Can anyone alter the audit log? | NO | ✓ |

Plus age-aware protections, directory non-enumeration, password and MFA
handling, encryption at rest, safeguarding triage, waiting-room state, and
permission-boundary invariants across every role.

The suite runs against a real database and exercises the same functions the API
routes use — not mocks of them.

---

## Deploying

**Render is the recommended host** — see **[docs/RENDER.md](docs/RENDER.md)**
for a step-by-step walkthrough including DNS, email and first-run setup.
Want a live link today at no cost, before registering a domain? See
**[docs/RENDER-FREE.md](docs/RENDER-FREE.md)** — a free Render web service plus
a free Neon database, deployed from `render-free.yaml`.
Configurations are also included for Docker, Railway (`railway.json`), Fly.io
(`fly.toml`) and Vercel (`vercel.json`); see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for how to choose between them.

The short version, for any host:

1. Provision one PostgreSQL 16 database.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` and
   `NEXT_PUBLIC_APP_URL`.
3. Run `npm run db:deploy` (the Docker image does this at container start).
4. Serve `npm run start`, health check at `/api/health`.

---

## Documentation

| Document | For |
|---|---|
| [docs/RENDER.md](docs/RENDER.md) | **Step-by-step deployment to Render at ipastor.church** |
| [docs/RENDER-FREE.md](docs/RENDER-FREE.md) | Free deployment to Render + Neon, no domain required |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Choosing a host, domains, backups, going live |
| [docs/SECURITY.md](docs/SECURITY.md) | The security model in full |
| [docs/SUPER-ADMIN.md](docs/SUPER-ADMIN.md) | The Setman: hierarchy, appointments, emergency controls |
| [docs/ADMIN.md](docs/ADMIN.md) | Administrators: members, counsellors, content, events |
| [docs/MODERATOR.md](docs/MODERATOR.md) | Moderators: the queue and its boundaries |
| [docs/COUNSELLOR.md](docs/COUNSELLOR.md) | Counsellors: sessions, the waiting room, notes |
| [docs/HIERARCHY.md](docs/HIERARCHY.md) | Setting up the church hierarchy |
| [docs/API.md](docs/API.md) | Every endpoint |
| [apps/mobile/README.md](apps/mobile/README.md) | Mobile builds and store submission |

---

## Before you go live

- [ ] Change or remove every demo account.
- [ ] Have legal and privacy advisers review and replace the policy pages.
- [ ] Confirm the leadership hierarchy records with the organisation.
- [ ] Set a real `DATA_ENCRYPTION_KEY` and back it up separately from the database.
- [ ] Configure email, or account verification cannot complete.
- [ ] Enable automated database backups and test a restore.
- [ ] Enrol MFA on every administrative account.
- [ ] Complete the safeguarding escalation procedure and name the leads.
- [ ] Replace the RCN mark with authorised official artwork, if authorised.

---

## Licence and use

This is ministry software handling people's confidences. If you deploy it,
you take on the duty of care that comes with that — read `docs/SECURITY.md`
before you do.
