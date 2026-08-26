# 𝒾Pastor — mobile application

The Android, iOS and tablet client. It talks to the same backend, the same
accounts, the same permissions and the same audit trail as the web application.
There is no second, weaker path into the platform for mobile.

## Running it

```bash
npm install
EXPO_PUBLIC_API_URL=http://localhost:3000 npm start
```

Then press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

On a physical device the API URL must be reachable from that device — use your
machine's LAN address rather than `localhost`, or point it at your deployed
instance.

## How authentication works here

The session token is stored in the device keychain (Keychain on iOS,
Keystore-backed encrypted preferences on Android) via `expo-secure-store`, and
presented as a `Bearer` credential. It is the same opaque token the browser
holds in an httpOnly cookie and resolves to the same session row server-side.

Biometric unlock (`expo-local-authentication`) re-opens an existing stored
session. It is never a substitute for the password on a fresh sign-in, and it
never bypasses multi-factor authentication.

## What is native and what opens the web view

Native: sign-in and MFA, the home dashboard, the counselling list and waiting
room, connection requests, the prayer wall, discipleship progress, profile and
notification registration.

Opens the secure web view: the live counselling conversation, the full
discipleship lesson reader, and the Privacy Centre. That is deliberate — it
keeps exactly one implementation of the conversation surface, its privacy
notices and its realtime handling, rather than a second one that could drift.

## Notifications

Push runs through Expo's service, which fronts both APNs and FCM. Payloads are
generic by policy: "you have an upcoming private pastoral session", never what
it concerns, so a notification on a lock screen discloses nothing.

Set `PUSH_NOTIFICATION_KEY` on the server to enable delivery. Without it the
server logs pushes and reports `not_configured` in the admin system monitor
rather than pretending they were delivered.

## Pointing it at your server

`EXPO_PUBLIC_API_URL` in `eas.json` is the only thing binding a build to your
database. Set it, per profile, to exactly the value of `NEXT_PUBLIC_APP_URL`
on the server. The app never holds a database connection string: it signs in
over the same API the website uses and gets the same session token.

`npm run build:android`, `npm run build:ios` and `npm run build:apk` all run
`scripts/check-api-url.mjs` first, which stops the build if the profile still
carries the placeholder or is not HTTPS. A build pointed at nothing installs
perfectly and then fails to sign anyone in, which looks like a broken account
rather than a broken build — so it is caught before the build, not after.

## Building

```bash
npm run build:apk       # a sideloadable .apk to host or send directly
npm run build:android   # an .aab for Google Play
npm run build:ios       # for the App Store
```

Before submitting to a store:

1. Set a real `projectId` in `app.json` under `extra.eas` — `npx eas
   build:configure` writes one for you.
2. Confirm `ios.bundleIdentifier` and `android.package` (`church.ipastor.app`)
   match the identifiers registered in App Store Connect and Play Console.
   A bundle identifier cannot be changed after the first store submission, so
   settle it now.
3. Set `EXPO_PUBLIC_API_URL` as above.
4. Replace `assets/icon.png`, `assets/adaptive-icon.png` and `assets/splash.png`
   if the organisation supplies authorised official artwork.
5. Complete the store privacy declarations. Both stores require an account
   deletion route: the platform provides one in the Privacy Centre, and the
   public URL is `/data-rights`.

See [`../../docs/MOBILE-APP.md`](../../docs/MOBILE-APP.md) for the costs and
the tradeoffs between browser install, a direct APK and Google Play.

## Store metadata

**Name.** iPastor

**Subtitle.** Pastoral counselling, prayer and discipleship

**Description.** iPastor is a private ministry platform for pastoral
counselling, prayer, discipleship and fellowship. Request counselling with an
approved counsellor, enter a private waiting room, submit prayer requests
publicly or privately, and work through discipleship courses at your own pace.

Nobody can start a private conversation with you unless you accept their
request. Counselling sessions are visible to you and your assigned counsellor.
Internal counselling notes are encrypted, and every access to them is recorded.

iPastor is not an emergency service and is not a substitute for emergency,
medical, psychological, psychiatric or legal care.

**Privacy policy URL.** `<your live URL>/privacy`
**Support URL.** `<your live URL>/contact`
**Account deletion URL.** `<your live URL>/data-rights`

**Age rating.** 12+ / PEGI 12 — the platform supports accounts for people under
18 with age-aware restrictions applied automatically.

**Permissions requested.** Biometric unlock, notifications. Camera and
microphone are declared but requested only if a member joins a voice or video
counselling session. Location and contacts are explicitly blocked.
