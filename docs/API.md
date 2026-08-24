# API reference

Every route enforces authorisation server-side. Nothing trusts a client-supplied
role, a hidden field, or the presence of a button.

**Base URL** — your deployment origin, e.g. `https://your-domain.example.org`

**Authentication** — browsers send the session cookie automatically. Native
clients present the same opaque token as `Authorization: Bearer <token>`, which
resolves to the same session row and the same audit trail.

**Response shape**

```jsonc
// Success
{ "ok": true, "data": { … } }

// Failure
{ "ok": false, "error": { "code": "forbidden", "message": "…", "detail": { … } } }
```

**Error codes you will meet**

| Code | Status | Meaning |
|---|---|---|
| `unauthenticated` | 401 | No valid session |
| `forbidden` | 403 | Authenticated, not permitted |
| `mfa_required` | 403 | Sensitive action; MFA not enabled |
| `mfa_challenge_required` | 403 | Sensitive action; MFA not satisfied this session |
| `reauth_required` | 403 | Sensitive action; no re-authentication in the last 10 minutes |
| `reason_required` | 400 | Sensitive action; a written reason is mandatory |
| `insufficient_authority` | 403 | Target holds equal or greater rank |
| `self_target_forbidden` | 403 | Governance actions refuse self-targeting |
| `rate_limited` | 429 | Too many requests; `detail.retryAfterSeconds` |
| `feature_disabled` | 503 | Switched off by an emergency control |
| `validation_failed` | 422 | `detail.issues` lists the fields |

---

## Authentication

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/register` | Response is identical whether or not the address exists |
| `POST` | `/api/auth/login` | Returns `{ mfaRequired: true }` with **no session** when a second factor is outstanding |
| `POST` | `/api/auth/logout` | Revokes the current session |
| `POST` | `/api/auth/verify-email` | |
| `POST` | `/api/auth/request-password-reset` | Response never reveals whether an address is registered |
| `POST` | `/api/auth/reset-password` | Revokes every session on success |
| `POST` | `/api/auth/reauthenticate` | Unlocks sensitive actions for 10 minutes |
| `POST` | `/api/auth/mfa/setup` | Returns the secret and otpauth URI |
| `POST` | `/api/auth/mfa/enable` | Confirms with a code |
| `POST` | `/api/auth/mfa/verify` | Satisfies MFA on this session |
| `POST` | `/api/auth/mfa/disable` | Refused when the role mandates MFA |
| `GET` | `/api/auth/sessions` | The caller's own devices |
| `DELETE` | `/api/auth/sessions` | `{ sessionId }` or `{ all: true }` |

---

## The caller

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/me` | Identity, roles, effective permissions. For rendering only — every route re-checks |
| `GET` `PATCH` | `/api/profile` | Email, age band, roles and status are **not** writable here |

---

## Counselling

| Method | Path | Who |
|---|---|---|
| `POST` | `/api/counselling/request` | Member. Runs safeguarding triage first |
| `GET` | `/api/counselling/requests` | Member — own requests only |
| `GET` | `/api/counselling/sessions` | Member or assigned counsellor |
| `GET` | `/api/counselling/sessions/{id}` | Member, assigned counsellor, or safeguarding with a reason |
| `POST` | `/api/counselling/sessions/{id}/join` | Participants only |
| `POST` | `/api/counselling/sessions/{id}/end` | Assigned counsellor only |
| `POST` | `/api/counselling/sessions/{id}/cancel` | Either participant |
| `GET` `POST` | `/api/counselling/sessions/{id}/notes` | `GET` returns internal notes only to the assigned counsellor. `POST` is counsellor-only |

---

## Counsellor portal

| Method | Path |
|---|---|
| `GET` | `/api/counsellor/dashboard` |
| `GET` `PUT` | `/api/counsellor/availability` |
| `POST` | `/api/counsellor/requests/{id}/accept` |
| `POST` | `/api/counsellor/requests/{id}/decline` |
| `GET` `POST` | `/api/counsellor/apply` — `status` is **not** accepted from the body |

---

## Connections and messaging

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/connections` | |
| `POST` | `/api/connections/request` | One short intro message; 5 per day |
| `POST` | `/api/connections/{id}/accept` | **Creates the conversation.** Nothing exists before this |
| `POST` | `/api/connections/{id}/decline` | Optional `{ block: true }`; starts a 30-day cooldown |
| `GET` | `/api/messages/conversations` | Counselling threads returned separately |
| `GET` | `/api/messages/conversations/{id}` | Membership verified in the query |
| `POST` | `/api/messages` | Re-checks membership, activity and blocks on every send |
| `POST` `DELETE` | `/api/users/{id}/block` | |
| `GET` | `/api/directory?q=` | Min 3 characters; opted-in members only; never minors; no email |

---

## Prayer, learning, events

| Method | Path |
|---|---|
| `GET` `POST` | `/api/prayers` — `?scope=public\|mine\|ministry` |
| `DELETE` | `/api/prayers/{id}` — author only |
| `POST` | `/api/prayers/{id}/pray` |
| `GET` | `/api/courses` |
| `GET` | `/api/courses/{slug}` |
| `POST` | `/api/courses/{slug}/progress` |
| `GET` | `/api/resources` |
| `GET` | `/api/events` |
| `POST` `DELETE` | `/api/events/{id}/register` |

---

## Notifications and privacy

| Method | Path |
|---|---|
| `GET` `PATCH` `PUT` | `/api/notifications` |
| `POST` `DELETE` | `/api/notifications/push-token` |
| `GET` `PATCH` | `/api/privacy/settings` |
| `GET` | `/api/privacy/export` — names what it excludes, and why |
| `GET` `POST` | `/api/privacy/data-request` |
| `POST` | `/api/reports` |
| `GET` | `/api/reports` — own reports |

---

## Realtime

`GET /api/realtime` — Server-Sent Events.

Optional `?conversationId=` and `?sessionId=`. The subscription set is derived
server-side from who the caller actually is; a crafted channel name subscribes
to nothing.

Events: `notification`, `message.created`, `counsellor.joined`,
`member.waiting`, `session.ended`, `session.cancelled`, `request.available`,
`emergency.control`.

---

## Administration

Every route requires its permission. Sensitive ones additionally require MFA,
re-authentication within 10 minutes, and a written reason of at least 8
characters.

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/admin/overview` | `analytics.view` |
| `GET` | `/api/admin/users` | `users.view` |
| `GET` `PATCH` | `/api/admin/users/{id}` | varies by action |
| `GET` | `/api/admin/counsellors` | `counsellors.manage` |
| `PATCH` | `/api/admin/counsellors/{id}` | `counsellors.verify` / `.suspend` |
| `GET` `PATCH` `POST` | `/api/admin/counselling` | `counselling.view` / `.assign` |
| `GET` | `/api/admin/reports` | `reports.view` |
| `PATCH` | `/api/admin/reports/{id}` | `reports.resolve` / `.escalate` |
| `GET` | `/api/admin/safeguarding` | `safeguarding.view` **(sensitive)** |
| `GET` `PATCH` | `/api/admin/safeguarding/{id}` | `safeguarding.view` / `.manage` **(sensitive)** |
| `GET` `POST` `PATCH` | `/api/admin/content` | `content.*` |
| `GET` `POST` `PATCH` | `/api/admin/events` | `events.*` |
| `GET` `POST` | `/api/admin/announcements` | `announcements.send` |
| `GET` `POST` | `/api/admin/centers` | `centers.manage` |
| `GET` `PATCH` | `/api/admin/data-governance` | `data_governance.manage` **(sensitive)** |
| `GET` | `/api/admin/security` | `security.manage` **(sensitive)** |
| `GET` | `/api/admin/audit` | `audit_logs.view` — read-only, always |
| `GET` `POST` `DELETE` | `/api/admin/support-mode` | `support_mode.use` **(sensitive)** |

### Super Admin

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/super-admin/overview` | `audit_logs.view` |
| `GET` `POST` `PATCH` | `/api/super-admin/hierarchy` | `hierarchy.manage` **(sensitive)** |
| `GET` `POST` | `/api/super-admin/admins` | `admins.manage` **(sensitive)** |
| `GET` `POST` | `/api/super-admin/permissions` | `permissions.manage` **(sensitive)** |
| `GET` `POST` | `/api/super-admin/emergency-controls` | `emergency_controls.manage` **(sensitive)**, plus a typed `CONFIRM` |

---

## Health

`GET /api/health` — no authentication.

`200` when healthy, `503` when the database is unreachable. Reports per-service
state, database latency, uptime and realtime subscriber count. A service that is
not configured says `not_configured` rather than showing a reassuring green.

---

## Rate limits

| Bucket | Limit |
|---|---|
| Sign-in | 8 per 5 minutes, per address **and** per IP |
| Registration | 5 per hour |
| Password reset | 5 per hour |
| Connection requests | 5 per day |
| Counselling requests | 3 per day |
| Messages | 60 per minute |
| Prayer requests | 10 per hour |
| Reports | 10 per hour |
| MFA challenges | 10 per 15 minutes |
