# Administrator guide

Day-to-day operation of the platform, under senior leadership.

---

## What you can reach

The Admin portal shows only what your permissions carry, so two administrators
may see different navigation. That is intended.

| Area | Permission |
|---|---|
| Overview | `analytics.view` |
| Users | `users.view` |
| Counsellors | `counsellors.manage` |
| Counselling | `counselling.view` |
| Content | `content.edit` |
| Events | `events.edit` |
| Announcements | `announcements.send` |
| Ministry Centres | `centers.manage` |
| Safeguarding | `safeguarding.view` |
| Data Governance | `data_governance.manage` |
| Security | `security.manage` |
| Audit Log | `audit_logs.view` |

---

## Enrol MFA first

Sensitive actions stay blocked until you do, and several ordinary-looking
administrative tasks are sensitive. **Privacy & Security → Multi-factor
authentication.**

---

## Members

**Admin → Users.**

You can suspend, reinstate, disable, revoke sessions, require MFA, require a
password reset, assign non-administrative roles and set a ministry centre.

Every action needs a written reason of at least eight characters, recorded
permanently. Write something a colleague could act on in six months.

**Rows marked "No authority"** hold rank equal to or above yours. The server
refuses those actions independently of what the interface shows.

**What this page deliberately does not show**: counselling history, message
content, prayer content. Administering an account does not require reading the
person's pastoral life.

---

## Counsellors

**Admin → Counsellors.**

Verification is the moment someone may begin receiving people's pastoral
confidences. Before approving, check:

- **Safeguarding acknowledged** and **policies accepted** — both are shown.
- **Approved to work with young people?** If they have asked for it, that needs
  a deliberate decision under your safeguarding policy, not a default.
- **References and qualifications** — read them.

Approving attaches the counsellor role and makes MFA a standing requirement.

**Suspending** returns their open requests to the queue for reassignment rather
than cancelling on the members waiting. Nobody's request is dropped because a
counsellor became unavailable.

---

## Counselling operations

**Admin → Counselling.**

You see the shape of the queue — who is waiting, in which category, how urgent,
who is assigned — and you can move work between counsellors.

**You do not see what anyone wishes to discuss.** The API does not select it.
Running counselling operations does not require reading counselling, and the
boundary is the point of the role.

**Suggest matches** ranks counsellors by category fit, language, preferred
counsellor gender, ministry centre and current caseload. Where nothing matches,
the request stays in the queue rather than being matched against the member's
wishes.

Watch the **capacity bars**. A counsellor at their limit takes no new sessions —
pastoral care done badly because someone is overloaded helps nobody.

---

## Content

**Admin → Content.**

Creating and publishing are separate permissions. New content is always a draft.

Draft → Review → Published → Archived. Publishing requires `content.publish`,
which lets an organisation give someone the ability to prepare teaching material
without the authority to release it.

---

## Events

**Admin → Events.**

Create, publish, unpublish, duplicate, send reminders, cancel.

**Cancelling requires a reason, and every registrant is told in those words.**
Write it for them, not for the record.

Joining links are released only to registered members, never on the public page.

---

## Announcements

**Admin → Announcements.**

Target by role, country, ministry centre, or everyone. Choose in-app, email,
push, or a combination. Schedule for later if you wish.

Announcements are a category members can switch off. Respect that — it is what
keeps the notices that *cannot* be switched off, security and safeguarding,
meaningful.

**Never put counselling detail or personal information in an announcement.**

---

## Safeguarding

Requires `safeguarding.view`, which most administrators do not hold.

If you do: opening a case requires a written reason, and your access is recorded
permanently against that case. Open a case because your role requires it, not
because you can.

---

## Data governance

**Admin → Data Governance.** Members' export, correction, deletion and consent
requests.

On a deletion request, answer honestly. Some records cannot be erased —
safeguarding history where retention is a legal obligation, and audit entries,
which exist precisely so administrative action cannot be made to disappear.
Tell the member specifically what was erased and what was retained, and why.

---

## Things you cannot do, by design

- Read counselling conversations or counsellor notes.
- Change your own role, or any role at or above your rank.
- Act on an administrator senior to you.
- Alter or delete anything in the audit log.
- Access an account invisibly. Support mode is time-boxed, recorded, scoped to
  configuration only, and the member is notified.
