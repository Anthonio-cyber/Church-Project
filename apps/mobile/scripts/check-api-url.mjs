/**
 * Refuse to build against a server that isn't there.
 *
 * The application holds no data of its own: every account, counselling record
 * and message it shows comes from the platform's one database, reached over
 * one URL. That URL is the only thing binding a build to the right server, and
 * getting it wrong produces an app that installs cleanly and then fails to
 * sign anyone in — which looks like a broken account rather than a broken
 * build. So it is checked before a build starts rather than after.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const profile = process.argv[2];
if (!profile) {
  console.error('Usage: node scripts/check-api-url.mjs <eas-profile>');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const eas = JSON.parse(readFileSync(join(here, '..', 'eas.json'), 'utf8'));
const url = eas.build?.[profile]?.env?.EXPO_PUBLIC_API_URL;

if (!url) {
  console.error(`\n  eas.json has no EXPO_PUBLIC_API_URL for the "${profile}" profile.\n`);
  process.exit(1);
}

if (url.includes('REPLACE-WITH-YOUR-LIVE-URL')) {
  console.error(
    `\n  The "${profile}" profile still points at the placeholder URL.\n\n` +
      `  Open apps/mobile/eas.json and set EXPO_PUBLIC_API_URL to the address\n` +
      `  people actually visit — the same one as NEXT_PUBLIC_APP_URL on the\n` +
      `  server. That is what points the app at your database.\n`,
  );
  process.exit(1);
}

try {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    console.error(
      `\n  The "${profile}" profile uses ${parsed.protocol}//. A released build must\n` +
        `  use https: — session tokens travel over this connection.\n`,
    );
    process.exit(1);
  }
} catch {
  console.error(`\n  "${url}" is not a valid URL.\n`);
  process.exit(1);
}

console.log(`Building "${profile}" against ${url}`);
