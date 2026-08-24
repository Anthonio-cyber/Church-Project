# The security model

This platform holds people's pastoral confidences. What follows is what
protects them, stated precisely enough to be checked.

---

## Authentication

**Passwords** are hashed with scrypt (N=32768, r=8, p=1) and a per-password
random salt. Verification is constant-time. Nothing stores a password in
readable form, and the strength policy is enforced server-side, not only in the
form.

**Sessions** are opaque 256-bit tokens. The database stores only an HMAC of the
token, so a database leak does not hand an attacker usable sessions. Sessions
carry a 12-hour idle timeout and a 7-day absolute expiry.

Browsers receive the token as an httpOnly, Secure, SameSite=Lax cookie with the
`__Host-` prefix in production. The mobile apps hold the same token in the
device keychain and present it as a Bearer credential — one session row, one
authorisation model, one audit trail.

**Multi-factor authentication** is TOTP (RFC 6238), accepting one step of clock
drift either side. It is mandatory for counsellors, pastors, moderators and
every administrative role, and those people cannot switch it off — the
requirement follows the office, not preference.

**Account protection.** Eight failed attempts locks an account for 15 minutes
and emails the holder. Rate limits are applied per address *and* per IP, so
neither a single IP nor a botnet gets an easy path. A password reset revokes
every session.

---

## Authorisation

Every protected route resolves the caller server-side. Nothing trusts a
client-supplied role, a hidden field, local storage, or the presence of a
button.

**Permissions are granular** — 47 of them, listed in
`apps/web/src/lib/permissions.ts`. Effective permissions resolve as:

1. the union of everything the caller's active roles carry,
2. plus explicit per-user grants,
3. minus explicit per-user denials — **a denial always wins**.

Expired role assignments and expired overrides are ignored.

**Ranks order the hierarchy.** From `USER` (0) to `SUPER_ADMIN` (100). Three
guards run on every governance action:

| Guard | Refuses |
|---|---|
| `requirePermission` | Callers without the specific permission. For sensitive permissions, also those without MFA, without a re-authentication in the last ten minutes, or without a written reason. |
| `requireAuthorityOver` | Self-targeting, outright. And any target of equal or greater rank. |
| `requireCanGrantRole` / `requireCanGrantPermission` | Granting a role at or above your own rank, or a permission you do not hold yourself. |

Together these make the specification's questions answer themselves
structurally: an administrator cannot promote themselves, a senior
administrator cannot strip the Setman, and nobody can quietly elevate a peer.

**Sensitive permissions** — counselling notes, safeguarding, hierarchy,
appointments, permissions, security, emergency controls, support mode, data
governance — additionally demand MFA, fresh re-authentication and a recorded
reason.

---

## The counselling boundary

A counselling session is reachable through exactly three paths:

1. the member it belongs to,
2. the counsellor assigned to it,
3. a holder of `counselling.safeguarding_access`, with a written reason, whose
   access is recorded permanently against the record.

Being an administrator is not one of them — at any rank, including Super Admin.

**Internal counsellor notes** are encrypted with AES-256-GCM before they reach
the database, are never shown to the member, and record every read against the
note. **Shared follow-up notes**, written deliberately for the member, are a
separate kind.

**Moderators** hold nothing from the counselling namespace. A message reported
from a counselling conversation is withheld from the moderation queue with an
explanation, and handled through safeguarding instead.

**Counselling administrators** run operations — assignment, scheduling,
capacity — without access to conversations or notes. The operations API does not
even select the member's summary.

---

## Consent-gated contact

No conversation row exists between two members until the recipient accepts a
connection request. One short introduction message is permitted with the
request; there is nowhere else for a requester to write.

A decline is not announced to the requester — being told "declined" invites
pressure — and starts a 30-day cooldown before another request is possible.

**Blocking** takes effect at every read and write path: existing peer
conversations are deactivated, notifications stop, further requests are refused,
and the conversation disappears from both message lists.

**Age-aware protection.** Adults and minors cannot open private channels through
ordinary connection requests. Minors never appear in directory search. A
counselling request from a minor can only be taken by a counsellor specifically
approved for that work.

**The directory does not enumerate the membership.** Search needs three or more
characters, returns only members who opted in to discoverability, excludes
minors and blocked relationships, and never returns an email address.

---

## Encryption

| What | How |
|---|---|
| In transit | HTTPS, HSTS with preload, `upgrade-insecure-requests` |
| Passwords | scrypt with per-password salt |
| Session and verification tokens | HMAC-SHA256, only the HMAC stored |
| Counselling notes | AES-256-GCM, application-layer, before the database |
| Safeguarding narratives | AES-256-GCM, application-layer |

GCM gives tamper detection as well as confidentiality: an altered ciphertext
fails to decrypt rather than yielding altered plaintext.

---

## Audit and accountability

The audit log records who, what, to whom, when, why and from where — for every
privileged action, and for every denial.

**It is append-only at the database level.** A trigger rejects `UPDATE` and
`DELETE`. The single exception is releasing `actorId` to `NULL` when an account
is erased under a data-rights obligation: the entry survives with its content
unchanged, and the denormalised `actorEmail`/`actorRole` keep it meaningful.

The same protection covers `session_note_access`, `safeguarding_access` and
`hierarchy_changes`.

A deliberate, recorded purge remains possible, but only by a database superuser
setting `app.audit_maintenance = 'on'` for the transaction — visible in the
database logs rather than invisible in the product.

**Support mode is not impersonation.** There is no way to become another
person. It creates a time-boxed, recorded window in which support staff may view
an account's *configuration*; counselling content, notes and safeguarding
records are outside its scope entirely. The member is always notified.

---

## Application security

| Control | Implementation |
|---|---|
| Content Security Policy | Set in `next.config.mjs`; `frame-ancestors 'none'`, `object-src 'none'` |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| CSRF | SameSite=Lax cookies plus an explicit same-origin check on every state-changing request |
| SQL injection | Prisma parameterised queries throughout; raw SQL only for aggregate counts, with no interpolated user input |
| XSS | React escaping; no `dangerouslySetInnerHTML` anywhere in the codebase |
| IDOR | Every resource read is scoped by ownership or membership in the query itself, not filtered afterwards |
| Mass assignment | Zod schemas per route; role, status and permission fields are never accepted from a request body |
| Rate limiting | Per-bucket, Postgres-backed, shared across instances |
| Private surface indexing | `noindex` headers plus `robots.txt` plus authentication |

**Notification hygiene.** Titles and bodies never carry counselling specifics.
"You have an upcoming private pastoral session", never what it concerns — a
lock-screen preview must disclose nothing.

---

## What we do not claim

We do not tell members their information is "100% private" or that nobody can
ever access it, because that would not be true of any system.

What is true: information is protected by encryption, strict access rules and
recorded access. Authorised personnel may reach it where necessary for platform
operation, safeguarding, legal obligations or security — and when they do, there
is a permanent record of who, when and why.

---

## Verifying the model

```bash
npm run test
```

49 tests assert these boundaries against a real database, exercising the same
functions the API routes use. See the table in the root README.

---

## Reporting a vulnerability

Contact the ministry office through the deployment's Contact page. Please give
the operators reasonable time to respond before disclosing publicly.
