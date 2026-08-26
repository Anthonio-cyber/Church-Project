# Getting 𝒾Pastor onto phones

Three routes, in the order most people should try them. All three talk to the
**same server and the same database** — the mobile app holds no data of its
own. What binds a build to your database is a single URL, and nothing else.

| Route | Cost | Warnings the member sees | Works on |
| --- | --- | --- | --- |
| **Install from the browser** | Free | None | Android, iPhone, iPad, Windows, Mac, Linux |
| **Direct APK download** | Free | Two, unavoidable (see below) | Android only |
| **Google Play** | £/$25 once | None | Android only |

---

## Route 1 — Install from the browser (recommended, free, no warnings)

This already works. Send anyone to **`/download`** on your live site and they
get an install button; on iPhone they get the Safari instructions instead,
because Apple does not allow one-tap install.

There is genuinely nothing to download, so there is no file for Chrome to
flag and no permission for Android to ask about. The browser adds iPastor to
the home screen with its own icon, opens it without an address bar, and points
it at your server — same accounts, same counselling records, same database.

**What makes it work**, if you ever need to check it:

- `apps/web/public/manifest.webmanifest` — name, icons at 192 and 512, and
  `display: standalone`.
- `apps/web/public/sw.js` — the service worker. Registered by
  `ServiceWorkerRegistrar`, and **only in a production build**, so it will not
  appear when running locally with `npm run dev`.
- `worker-src 'self'` and `manifest-src 'self'` in the CSP in
  `apps/web/next.config.mjs`.
- HTTPS. Browsers refuse to install a site served over plain HTTP.

Notifications work here too, on Android immediately and on iPhone once the app
has been added to the home screen — see the VAPID keys in `.env.example`.

---

## Route 2 — A downloadable APK (free, but Android will warn)

Useful when you want a real installable file to send over WhatsApp rather than
a link.

```bash
cd apps/mobile
npm install
npx eas login                 # a free Expo account
npx eas build:configure       # writes a real projectId into app.json
npm run build:apk
```

`build:apk` refuses to start until `EXPO_PUBLIC_API_URL` in `eas.json` points
at your live site rather than the placeholder — that URL is the only thing
connecting the app to your database, and a wrong one produces an app that
installs perfectly and then cannot sign anyone in.

EAS builds on Expo's free tier, on a shared queue. When it finishes you get a
download link; put that `.apk` file somewhere people can reach it.

**Be honest with people about the two prompts.** They cannot be removed by
anything you do to the site or the file:

1. Chrome says *"This type of file can harm your device"* for every `.apk`
   from every website. It is a blanket rule about the file type, not a
   judgement about yours. They tap **Download anyway**.
2. Android then asks for permission to *"install unknown apps"* from the app
   they downloaded with. This is the Android sideloading protection. They allow
   it once.

Anyone promising an APK download with no warnings is describing Google Play.
If those two prompts are unacceptable, use Route 1 or Route 3.

---

## Route 3 — Google Play

Not free, but close: **a one-off $25 registration fee**, no annual renewal.
(Apple's App Store is $99 *per year* by comparison.)

1. Register at <https://play.google.com/console> and pay the $25.
2. Choose the account type carefully. A **personal** account created now must
   run a closed test with **at least 12 testers for 14 continuous days** before
   it can apply for production access. An **organisation** account — which the
   church would register as, with its registration details — is not subject to
   that. Registering the church rather than yourself saves a fortnight.
3. Build the store bundle:
   ```bash
   cd apps/mobile
   npm run build:android        # AAB, which is what Play requires
   npm run submit:android
   ```
4. Fill in the store listing. `apps/mobile/README.md` already has the name,
   description, age rating and permission notes written out. Play also requires
   three URLs, all of which exist on your site: `/privacy`, `/contact` and
   `/data-rights` for account deletion.
5. Review takes a few days for a first submission.

---

## The one setting that matters

`EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`. Set it to exactly the same
value as `NEXT_PUBLIC_APP_URL` on the server — the address people type into a
browser.

```json
"production": {
  "autoIncrement": true,
  "env": { "EXPO_PUBLIC_API_URL": "https://your-live-url" }
}
```

Set it in the `production`, `preview` and `apk` profiles. `npm run build:apk`
and `npm run build:android` both check it first and stop with an explanation
rather than shipping a build pointed at nothing.

You do **not** give the mobile app a database connection string. It never
touches the database directly; it signs in over the same API the website uses,
gets the same session token, and is subject to the same permissions and the
same audit trail.
