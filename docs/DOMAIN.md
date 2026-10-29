# Putting 𝒾Pastor on rcnipastor.com

Everything in this repository is already set to `https://rcnipastor.com`. What
is left is buying the name and telling Vercel about it.

Budget: **$11.25 for the first year**, and about the same every year after —
`.com` has no introductory pricing to fall off, which is half the reason to
prefer it over a $1.99 novelty extension.

---

## Step 1 — Buy it

<https://vercel.com/domains/search?q=rcnipastor.com>

Buy it inside the same Vercel account the project is deployed from. Vercel
sells at cost and, more usefully, configures the DNS and issues the TLS
certificate itself — there are no nameservers to copy and no propagation to sit
and debug.

At checkout, confirm three things:

- **Auto-renew is on.** An expired domain is bought by a squatter within hours,
  and buying it back costs many times the renewal.
- **WHOIS privacy is on.** Free at Vercel, and it matters here more than for a
  normal site: without it your home address and telephone number are published
  in a public database attached to a pastoral counselling platform.
- **The spelling.** `rcnipastor.com`. A domain typo is not refundable.

## Step 2 — Attach it to the project

Vercel dashboard → the `ipastor` project → **Settings → Domains → Add**.

Add **both**:

| Domain | Set as |
| --- | --- |
| `rcnipastor.com` | Primary |
| `www.rcnipastor.com` | Redirect to `rcnipastor.com` |

Adding `www` matters. People type it out of habit, and a `www` that does not
resolve looks broken rather than merely unused. Vercel wires the redirect for
you; it does not happen on its own.

The certificate is issued automatically within a minute or two. You do not
configure HTTPS anywhere.

## Step 3 — Tell the application its own address

Vercel → **Settings → Environment Variables**. Change `NEXT_PUBLIC_APP_URL` in
**all three environments** (Production, Preview, Development):

```
NEXT_PUBLIC_APP_URL = https://rcnipastor.com
```

This is the single value the whole platform reads its own address from. It
drives the canonical URLs, the link-preview card, the PWA manifest, the
sitemap, and the same-origin check. Nothing else hardcodes a domain.

While you are on that screen, the two push-notification keys are still
outstanding:

```
VAPID_PUBLIC_KEY  = BCaA5e_E7O2_Cq7j-VwaR3FePBxZbqojYI37keh0OSy0oUUYFsiW4tnz40OGtIK3NW3HWmFTM-WhMga3BEm1V54
VAPID_PRIVATE_KEY = dHHzVdRNPVH0RpKAVkjITRQpl1Fz622KBwOKlcS9GDw
```

## Step 4 — Redeploy

Environment variables are read at build time, so the change does not take
effect until a new build runs. Vercel → **Deployments** → the latest one →
**Redeploy**.

## Step 5 — Check it

```bash
curl -sI https://rcnipastor.com | head -1              # 200
curl -s  https://rcnipastor.com/api/health             # {"status":"ok",...}
curl -s  https://rcnipastor.com/robots.txt | tail -1   # the absolute sitemap URL
curl -sI https://www.rcnipastor.com | head -1          # 307/308 redirect
```

Then in a browser:

- Sign in as `tony@rcnglobal.com`.
- Open `/download` and install it — the address bar should disappear and the
  home-screen icon should be the gold RCN mark.
- Paste `https://rcnipastor.com` into a WhatsApp chat with yourself. A gold
  preview card should appear. If it does not, WhatsApp has cached the old
  empty preview; it clears within a day.

## Step 6 — Tell Google it exists

<https://search.google.com/search-console> → Add property → `rcnipastor.com`
→ verify (Vercel-hosted domains verify by DNS in one click) → **Sitemaps** →
submit `sitemap.xml`.

Only the public pages are listed. Everything behind sign-in is excluded from
the sitemap, disallowed in `robots.txt`, and additionally sends `noindex`
headers — so a crawler that ignores the file still reaches nothing.

---

## Afterwards

**Email.** `EMAIL_FROM` is set to `iPastor <no-reply@rcnipastor.com>`, but
sending will not work until the domain is verified with a mail provider. In
Resend or similar: add `rcnipastor.com` as a sending domain, add the SPF, DKIM
and DMARC records it gives you, then set `EMAIL_API_KEY`. Sign-up does not
depend on email, so this can wait.

**The mobile app.** `apps/mobile/eas.json` already points every build profile
at `https://rcnipastor.com`, and the build scripts refuse to run if that is
ever wrong. See [MOBILE-APP.md](MOBILE-APP.md).

**Security settings worth doing once**, all free and all at the registrar:
transfer lock on, two-factor authentication on the Vercel account, and DNSSEC
enabled. Whoever controls the domain controls the site and every address on
it, so the two-factor switch is the highest-value minute you will spend.

**The old Vercel URL** keeps working. Nothing breaks by adding a domain; the
`*.vercel.app` address stays valid as a fallback.

---

## Making more links, later

A web address is read **right to left**, and each part costs something
different:

```
          ipastor  .  rcnipastor  .  com
             │            │            │
             │            │            └── the ending. Owned by a registry.
             │            │                You cannot invent one. Existing
             │            │                endings only: .com, .org, .church,
             │            │                .ng, and about 1,500 others.
             │            │
             │            └── the name. You RENT this, yearly, from a
             │                registrar. $11.25/year. This is the only
             │                part anyone charges for.
             │
             └── a subdomain. FREE, instant, and unlimited. Once the
                 middle part is yours, you mint as many of these as you
                 like without paying anyone again.
```

So once `rcnipastor.com` is bought, every one of these is free and yours:

| Link | What it might be |
| --- | --- |
| `give.rcnipastor.com` | Giving and offerings |
| `watch.rcnipastor.com` | Services and teaching video |
| `events.rcnipastor.com` | A standalone events page |
| `app.rcnipastor.com` | The platform itself, if you ever split it off |
| `staging.rcnipastor.com` | A test copy, safe to break |

### How to add one

1. Vercel → the project → **Settings → Domains → Add** → type the full
   subdomain, e.g. `give.rcnipastor.com`.
2. If the domain was bought through Vercel, the DNS record is written for you
   and there is nothing else to do.
3. If it was bought elsewhere, Vercel shows one record to add at the registrar:
   a `CNAME` on the subdomain's name, pointing at the value Vercel gives.
4. The certificate issues automatically, usually within a minute.

Subdomains can point at completely different services — one at this platform,
another at a video host, another at a giving provider. They share nothing but
the name.

### Pointing a subdomain of a domain you already own

The same applies in reverse. If the ministry controls `rcnglobal.com`, then
`ipastor.rcnglobal.com` can be added to this project for free: add it in
Vercel, then whoever manages `rcnglobal.com`'s DNS adds the single `CNAME`
record Vercel displays.

Worth weighing before relying on it: an address under a domain someone else
renews is an address you can lose without warning. Keeping `rcnipastor.com` as
the canonical address and pointing `ipastor.rcnglobal.com` at it gives you the
familiar name without that exposure.

### Making your own ending (`.rcn`)

Possible, but not realistically: an ICANN application for a new top-level
domain costs roughly **$185,000**, plus around **$25,000 a year** to operate,
and applications only open in occasional rounds. This is how `.google` and
`.bmw` exist. It is not a route for a ministry platform — a subdomain gives you
the same visual effect for nothing.
