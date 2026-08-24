# Super Admin guide — the Setman

The highest office on the platform. It carries the whole permission catalogue,
and every use of it is recorded.

---

## What this office is for

Four things, roughly in order of how often you will do them:

1. **Appointing and removing administrators.** Nobody else can create senior
   office.
2. **Maintaining the church hierarchy** — who holds which office, under whose
   supervision.
3. **Granting and denying individual permissions**, so people hold what their
   work needs and no more.
4. **Emergency containment**, on the rare day it is needed.

---

## Before you can do any of it

Enrol multi-factor authentication. Until you do, every sensitive action is
blocked — hierarchy changes, appointments, permissions, emergency controls, all
of it. This is not a formality that can be waived; there is no route around it
in the interface or the API.

**Privacy & Security → Multi-factor authentication → Set up.**

Sensitive actions also require a re-authentication within the last ten minutes.
If you are asked for your password again mid-task, that is why.

---

## First hour on a new deployment

1. Sign in and enrol MFA.
2. **Super Admin → Church Hierarchy.** The Setman, Rev. Tony and
   Pst. Gabriel Adayi records are seeded as *provisional*. For each one, either:
   - confirm it with **Confirm with the organisation** once you have verified
     that the named person genuinely holds that office, or
   - remove it and create the real record.

   Provisional records are never published on the public leadership page. That
   is deliberate: naming someone publicly as holding an office is a claim the
   organisation makes, not one the software should make on its behalf.
3. **Super Admin → Administrators.** Appoint the real administrators.
4. **Admin → Users.** Remove or suspend every demo account.
5. Read `docs/SECURITY.md`. You are now responsible for the promises it makes.

---

## Appointing an administrator

**Super Admin → Administrators → Appoint an administrator.**

Choose the person, the office, and write a reason. The reason is recorded
permanently and is what a future reviewer reads when asking why someone has the
access they have.

Appointing does three things beyond the grant itself: it makes MFA a standing
requirement on that account, it revokes their current sessions so the new
authority takes effect cleanly at their next sign-in, and it notifies them.

**What you cannot do**, and why the interface will not let you try:

- Appoint yourself to anything. Governance actions refuse self-targeting.
- Appoint someone to an office at or above your own rank.
- Act on anyone whose rank equals or exceeds yours.

---

## Granting and denying permissions

**Super Admin → Permissions.**

The **Role matrix** shows what each office carries. Read it occasionally — what
a role *does not* carry is the more interesting half.

**Individual overrides** are how least privilege works in practice:

- A **grant** adds a permission the person's roles do not carry.
- A **denial** removes one they would otherwise inherit. **A denial always
  wins.** This is how you give someone a senior office without also handing over
  counselling note access.

Prefer an expiring grant to a permanent one. A grant that expires on its own is
safer than one somebody has to remember to remove.

You can never grant a permission you do not hold yourself.

---

## The hierarchy

**Super Admin → Church Hierarchy.**

Each position records the person, their title, ministry role, administrative
role, supervisor, ministry centre and start date. Every change is written to an
append-only record with your reason, alongside the audit log.

**A position confers no access on its own.** Access comes from roles and
permissions, granted separately and audited separately. The hierarchy is the
church's governance record; the permission system is the technical control. They
inform each other but are not the same thing.

---

## Emergency controls

**Super Admin → Emergency Controls.** Blunt instruments, for containing an
incident in minutes without a deployment.

| Control | What it does |
|---|---|
| New registrations | Stops account creation |
| Private messaging | Freezes all member messaging |
| Connection requests | Stops new requests |
| Counselling intake | Stops new counselling requests |
| File uploads | Stops uploads |
| Maintenance mode | Places the member application in maintenance |
| Public prayer wall | Stops public prayer sharing |
| Revoke every session | Signs everyone out, everywhere, immediately |
| Global password reset | Every account must set a new password |
| Disable a ministry centre | Removes it from public view |
| Disable an administrator | Disables the account and revokes its sessions |

Each requires a typed `CONFIRM`, a written reason, and MFA with fresh
re-authentication. Each notifies every senior leader by email. An emergency
action is never silent.

**Think before switching off counselling intake.** It means someone in
difficulty cannot ask for help. Sometimes that is the right call; weigh it
against whatever you are containing rather than reaching for it first.

---

## What this office does *not* give you

Holding the highest rank does not open a window into people's counselling
conversations.

- Counselling sessions remain reachable only by their member, their counsellor,
  or a safeguarding holder acting with a stated reason.
- Safeguarding cases require `safeguarding.view` — held by the office, still
  requiring you to open a specific case deliberately, with a reason, leaving a
  permanent record on that case.
- The audit log is append-only. You cannot erase your own actions. Nor can
  anyone acting on your behalf.

This is the point. An office that could quietly read anything is an office
nobody can safely trust with pastoral confidences.

---

## Reviewing administrative activity

**Admin → Audit Log.** Filter by action, actor, target or outcome.

Worth a periodic look:

- `outcome: DENIED` — a pattern of denials means someone is repeatedly reaching
  for access they do not have.
- `GOVERNANCE_*` — every appointment, removal, role and permission change.
- `SAFEGUARDING_CASE_ACCESSED` — who opened which case, and the reason they gave.
- `GOVERNANCE_EMERGENCY_CONTROL` — every emergency activation, ever.

**Admin → Security** shows failed sign-ins, locked accounts, permission
denials, session activity and live service state.
