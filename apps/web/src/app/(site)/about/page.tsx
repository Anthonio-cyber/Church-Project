import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/site/SiteChrome';
import { Card, GoldRule } from '@/components/ui';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Who this ministry platform is for, what it is built to do, and the principles that govern how it handles the trust placed in it.',
};

const VALUES = [
  {
    title: 'Apostolic Christianity',
    body: 'A commitment to the faith once delivered to the saints: the authority of Scripture, the person and work of Jesus Christ, and the ongoing ministry of the Holy Spirit in the church today.',
  },
  {
    title: 'Prayer',
    body: 'Prayer is not a feature of the ministry; it is the ground it stands on. Every part of this platform is designed to make asking for prayer easy and safe.',
  },
  {
    title: 'Discipleship',
    body: 'Believers are meant to mature. Structured teaching, tracked progress and real accountability serve that end rather than entertainment.',
  },
  {
    title: 'Fellowship',
    body: 'Genuine Christian community, formed by consent and protected from the pressures that make ordinary social platforms unsafe.',
  },
  {
    title: 'Missions',
    body: 'The gospel goes out. Ministry centres, events and training exist to equip believers who are sent.',
  },
  {
    title: 'Accountability',
    body: 'Those who lead are answerable. Every administrative action on this platform is recorded, attributed and permanent.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A digital environment built for pastoral care"
        description="This platform exists so that believers can seek God, ask for help, be discipled and find fellowship — without the exposure, pressure and data harvesting that ordinary social platforms take for granted."
      />

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="space-y-6 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
          <p>
            Most software that people turn to in difficulty was not designed with their difficulty
            in mind. Conversations sit in the same inbox as everything else. Notifications announce
            on a lock screen what should have stayed between two people. Anyone can message anyone.
            Administrators can see everything because it was simpler to build that way.
          </p>
          <p>
            This platform was designed the other way round. The counselling boundary, the consent
            gate before private contact, the encrypted notes, the recorded access, the hierarchy of
            administrative authority — these are not features bolted onto a social app. They are the
            architecture.
          </p>
          <p>
            The result should feel like a place where you can say: I can seek spiritual guidance
            here, I can ask for prayer, I can speak to an approved counsellor, my counselling
            information is protected, I control who can contact me, and I know where to get
            additional professional help when pastoral counselling is not enough.
          </p>
        </div>

        <GoldRule className="my-14" />

        <h2 className="mb-8 font-serif text-2xl font-semibold">What we hold to</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {VALUES.map((value) => (
            <Card key={value.title} as="article">
              <h3 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">
                {value.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {value.body}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-14 rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100">
            About the name and identity
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            This platform draws on ministry principles publicly associated with Remnant Christian
            Network — prayer, the Word, discipleship, fellowship, apostolic Christianity and
            missions. It uses an original visual identity created for it, and it is{' '}
            <strong>not an official product of Remnant Christian Network</strong>. No claim of
            official status, endorsement or affiliation is made unless and until the organisation
            authorises it in writing. The platform is built to support an authorised organisational
            deployment should that authorisation be given.
          </p>
        </div>

        <p className="mt-10 text-sm text-ink-600 dark:text-parchment-300">
          Questions about how the platform is governed?{' '}
          <Link href="/leadership" className="font-medium text-gold-700 underline underline-offset-4 dark:text-gold-400">
            See the leadership and administration structure
          </Link>
          .
        </p>
      </section>
    </>
  );
}
