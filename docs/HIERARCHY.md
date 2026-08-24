# Setting up the church hierarchy

The hierarchy is the church's governance record: who holds which office, under
whose supervision, since when, and on whose authority. It is separate from the
permission system, and deliberately so.

---

## The distinction that matters

**A hierarchy position confers no access.** It records an office.

**Roles and permissions confer access.** They are granted separately, through
Administrators and Permissions, and audited separately.

The two inform each other but are not the same thing. Recording that someone is
an Administrator does not make them one technically; appointing them does.
Keeping these separate means the church's record of who holds office stays
truthful even while technical access is being adjusted around it.

---

## The seeded structure

Seeding creates three provisional records:

```
Setman — Super Admin
  └── Rev. Tony — Senior Leadership Administrator
        └── Pst. Gabriel Adayi — Administrator
              └── Moderators, counsellors, ministry leaders and other approved staff
```

All three are **provisional**: created pending approval, flagged as seed
placeholders, and deliberately **not published** on the public leadership page.

That flag is not bureaucratic caution. Publicly naming a person as holding an
office is a claim the organisation makes. The software should not make it on the
organisation's behalf because a name appeared in a specification document.

---

## Confirming or replacing them

**Super Admin → Church Hierarchy.** For each provisional record:

**If the organisation confirms the person holds that office:**
Manage → **Confirm with the organisation** → give a reason.
The record becomes non-provisional and appears on the public leadership page.

**If it does not, or you are unsure:**
Manage → **Remove** → give a reason, then create the correct record.

Until confirmed, nothing about a provisional record is published.

---

## Adding a position

**Super Admin → Church Hierarchy → Add a leadership position.**

| Field | What it is for |
|---|---|
| Person's name | As it should appear publicly, once confirmed |
| Title | The office — "Senior Leadership Administrator" |
| Ministry role | What they actually do |
| Administrative role | Which platform role the office corresponds to |
| Linked account | Their platform account, if they have one |
| Reports to | Their supervisor in the hierarchy |
| Ministry centre | If the office is centre-specific |
| Reason | Recorded permanently |

You cannot create a position at or above your own rank.

New positions are created **pending approval**. Approve deliberately, as a
second look at your own decision.

---

## Lifecycle

| Status | Meaning |
|---|---|
| Pending approval | Created, not yet in force |
| Active | In force. Published if confirmed with the organisation |
| Suspended | Temporarily set aside; the record remains |
| Removed | Ended, with an end date. The record remains |
| Archived | Historical |

Positions are never deleted. The record of who held what, and when, is part of
what makes the structure accountable.

---

## Reporting lines

Set **Reports to** so supervision is explicit. Reporting lines are used for
escalation paths, for showing supervising leadership on counsellor profiles, and
for making the structure legible when someone asks who answers to whom.

A position cannot supervise itself; the interface and the API both refuse it.

---

## Ministry centres

A position can be scoped to a centre. Centre-scoped leadership appears on that
centre's public page, and centre-scoped content and events are limited to its
members.

---

## Every change is recorded

Each change writes to an append-only hierarchy record with your reason,
alongside the audit log. Neither can be edited or deleted afterwards — including
by the Setman.

Review it at **Super Admin → System Overview → Recent hierarchy changes**, or
filter the audit log for `GOVERNANCE_HIERARCHY_CHANGED`.

---

## A worked example

Appointing a new counselling administrator for the Lagos centre:

1. **Church Hierarchy → Add a leadership position.**
   Name, title "Counselling Administrator, Lagos", ministry role, administrative
   role `COUNSELLING_ADMIN`, reports to the Administrator, centre Lagos. Reason:
   "Appointed by the ministry leadership meeting of 14 March."
2. **Approve** the position.
3. **Administrators → Appoint an administrator.** Same person,
   `COUNSELLING_ADMIN`, same reason.
4. **Permissions.** If they should not hold something the role carries by
   default, add a denial with a reason. If they need something extra, grant it —
   preferably with an expiry.
5. Tell them to enrol MFA. Until they do, their sensitive actions stay blocked.
