# What 𝒾Pastor costs, and what money would actually improve

**Prices in this file could not be verified from the session that wrote it** —
the pricing pages were unreachable. The domain figures were checked live on
11 September 2026; everything else is approximate and should be confirmed on
the provider's own page before you pay. Naira figures assume roughly
₦1,550 to the dollar, which moves.

---

## 1. Domains

Checked live on 11 September 2026. Availability can change, so re-check before
buying.

| Domain | USD/year | ≈ ₦/year | Verdict |
| --- | --- | --- | --- |
| **rcnipastor.com** | **$11.25** | **≈ ₦17,400** | **Chosen.** Already wired through the whole repo |
| ipastor.church | $11.99 | ≈ ₦18,600 | Good alternative, says what it is |
| ipastor.app | $9.99 | ≈ ₦15,500 | Cheapest, and HTTPS-forced by every browser |
| ipastor.care | $21.99 | ≈ ₦34,100 | Reads well, pricier |
| ipastor.cc | $15.00 | ≈ ₦23,300 | Short but meaningless |
| ipastor.faith | $27.00 | ≈ ₦41,900 | Dear for what it is |
| ipastor.co | $29.99 | ≈ ₦46,500 | People will type `.com` and reach someone else |
| ipastor.io | $30.00 | ≈ ₦46,500 | Wrong audience |
| myipastor.com / getipastor.com / ipastorapp.com | $11.25 | ≈ ₦17,400 | Real `.com`, but the prefix gets dropped when retold |

**Taken, not buyable:** `ipastor.com`, `ipastor.org`, `ipastor.net`.

**Avoid despite the price:** `ipastor.online` ($1.99), `ipastor.help` ($1.99),
`ipastor.life` ($3.99). Those are first-year teaser rates on extensions that
commonly renew at several times the intro price. A domain you cannot afford to
renew is a domain you lose, along with every link anyone saved.

---

## 2. What it costs to run today

Everything below is live and costing nothing.

| Thing | Provider | Plan | Cost |
| --- | --- | --- | --- |
| Hosting | Vercel | Hobby | ₦0 |
| Database | Neon | Free (≈0.5 GB) | ₦0 |
| Voice and video | meet.jit.si | Public | ₦0 |
| Browser notifications | Web Push (VAPID) | Self-hosted | ₦0 |
| File storage | The platform's own database | — | ₦0 |
| Realtime | Built-in SSE | — | ₦0 |

---

## 3. Free, and worth doing before spending anything

| Task | Effort | What it buys |
| --- | --- | --- |
| Paste the two VAPID keys into Vercel | 2 min | Turns browser notifications on. Keys already generated |
| Resend free tier + verify the domain | 20 min | Password resets and alerts actually send |
| Zoho Mail free tier | 30 min | A real `info@rcnipastor.com` mailbox |
| UptimeRobot or Better Stack, free | 10 min | You find out the site is down before a member tells you |
| Sentry free tier | 20 min | You see errors instead of guessing from a screenshot |
| Google Search Console | 5 min | The public pages get indexed |

None of these need a card. Together they are the single biggest improvement
available, and they cost nothing.

---

## 4. Money, in the order it is worth spending

| # | Item | Cost | Recurring? | When it becomes necessary |
| --- | --- | --- | --- | --- |
| 1 | **rcnipastor.com** | $11.25 ≈ ₦17,400 | Yearly | Now. A `.vercel.app` address does not look like a ministry |
| 2 | **Google Play registration** | $25 ≈ ₦38,700 | **One-off** | When you want it in the Play Store rather than sideloaded |
| 3 | **Neon paid tier** | ≈$19/mo ≈ ₦29,500/mo | Monthly | When the free 0.5 GB fills — see the warning below |
| 4 | **Vercel Pro** | ≈$20/mo ≈ ₦31,000/mo | Monthly | If traffic outgrows Hobby, or its licence terms stop fitting |
| 5 | **Apple App Store** | $99/yr ≈ ₦153,000/yr | **Yearly** | Only if iPhone members will not accept the browser install |

### The database limit is the thing most likely to force a payment

Uploads are stored **inside the Postgres database**, not in a separate bucket:
avatars up to 2 MB, message attachments up to 5 MB
(`apps/web/src/lib/domain/files.ts`). That was the right call for launch — no
third-party account, no public bucket URL to leak, and files are covered by the
same permissions and audit trail as everything else.

But Neon's free tier is about **0.5 GB total**. A few hundred message
attachments will reach it. When it fills, writes start failing — which looks
like the platform breaking, not like a bill being due.

Two options when that day comes: pay for the database tier, or move uploads to
object storage by replacing that one file. Cloudflare R2 has a large free tier
and no egress charges. Worth doing before it becomes urgent rather than after.

---

## 5. Sensible budgets

**If the budget is ₦10,000** — that is around $6.50, which is less than the
domain costs. Do everything in section 3, which is free and worth more than any
small purchase, and save toward the ₦17,400 for the domain.

**If the budget is ₦50,000 (≈$32)** — buy the domain (₦17,400) and the Google
Play registration (₦38,700) is just beyond it; buy the domain now and Play next
month. Everything in section 3 alongside.

**If the budget is $100 (≈₦155,000)** — domain, Google Play, and roughly six
months of head-room for a database tier if growth demands it. This is the
comfortable launch budget.

**If the budget is $10,000** — far more than this platform needs. It would
cover every item above for several years with most of it unspent. The honest
advice is not to spend it on infrastructure: the costs here are small by
design. Put it toward people — someone to answer the counselling queue,
safeguarding training for the counsellors, or a designer for the brand.
