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

## Building for the stores

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Before submitting:

1. Set a real `projectId` in `app.json` under `extra.eas`.
2. Confirm `ios.bundleIdentifier` and `android.package` (`church.ipastor.app`)
   match the identifiers registered in App Store Connect and Play Console.
   These follow reverse-DNS from the domain — `ipastor.church` becomes
   `church.ipastor.app`. A bundle identifier cannot be changed after the first
   store submission, so settle it now.
3. Set the production `EXPO_PUBLIC_API_URL` in `eas.json` to the deployed domain.
4. Replace `assets/icon.png`, `assets/adaptive-icon.png` and `assets/splash.png`
   if the organisation supplies authorised official artwork.
5. Complete the store privacy declarations. Both stores require an account
   deletion route: the platform provides one in the Privacy Centre, and the
   public URL is `/data-rights`.

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

**Privacy policy URL.** `https://ipastor.church/privacy`
**Support URL.** `https://ipastor.church/contact`
**Account deletion URL.** `https://ipastor.church/data-rights`

**Age rating.** 12+ / PEGI 12 — the platform supports accounts for people under
18 with age-aware restrictions applied automatically.

**Permissions requested.** Biometric unlock, notifications. Camera and
microphone are declared but requested only if a member joins a voice or video
counselling session. Location and contacts are explicitly blocked.
