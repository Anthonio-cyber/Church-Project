# 𝒾Pastor brand assets

`logo.svg` is an **original mark created for this platform**: a golden seal
carrying the letters RCN above an open book and a flame. It is not a
reproduction of any organisation's official logo, and this platform does not
claim to be an official product of Remnant Christian Network.

## Deploying under authorised official branding

If the organisation authorises use of its official identity:

1. Replace `public/brand/logo.svg` with the supplied vector asset (keep the
   filename, and keep the artwork square so the app icon crops correctly).
2. Replace `public/icons/icon-192.png` and `public/icons/icon-512.png` with
   raster exports at those sizes, and `apps/mobile/assets/icon.png` /
   `apps/mobile/assets/splash.png` for the store builds.
3. Optionally set `NEXT_PUBLIC_BRAND_LOGO_URL` to serve the mark from a CDN.
4. Update `NEXT_PUBLIC_BRAND_NAME` if the display name differs.

Every surface — website header and footer, member app, all four staff portals,
the PWA manifest, the mobile app icon and the email templates — reads the mark
from `src/components/brand/Logo.tsx` and these asset paths, so the change is
made in one place.

Until such authorisation is in place, keep the original mark. Do not add
official logos, copyrighted graphics or claims of official status.
