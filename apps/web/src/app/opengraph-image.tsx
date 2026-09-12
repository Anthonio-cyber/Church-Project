import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The link preview card.
 *
 * A link to a pastoral platform gets shared by the person who most needs it to
 * look legitimate — into a family chat, or to someone deciding whether to trust
 * it with something they have told nobody. A shared link with no preview image
 * reads as suspect, so this generates one from the brand mark rather than
 * leaving the card blank.
 *
 * Deliberately says nothing about counselling in the image itself: the card is
 * rendered in the chat before anyone taps it, where other people can see it.
 */

export const runtime = 'nodejs';
export const alt = 'iPastor — Remnant Christian Network';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GOLD = '#c9922a';
const GOLD_LIGHT = '#e8c469';
const INK = '#111110';

export default async function OpenGraphImage() {
  // Read from the filesystem rather than fetching over the network: the image
  // is generated at build time, when the site is not yet serving.
  const logo = readFileSync(join(process.cwd(), 'public', 'brand', 'logo.svg')).toString('base64');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: INK,
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${logo}`} width={168} height={168} alt="" />

        <div
          style={{
            marginTop: 40,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -1,
            color: GOLD_LIGHT,
          }}
        >
          iPastor
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 32,
            color: '#d9d4c7',
            letterSpacing: 1,
          }}
        >
          Remnant Christian Network
        </div>

        <div style={{ display: 'flex', marginTop: 44, width: 320, height: 3, background: GOLD }} />

        <div style={{ marginTop: 36, fontSize: 27, color: '#a8a296' }}>
          Counselling · Prayer · Discipleship · Fellowship
        </div>
      </div>
    ),
    size,
  );
}
