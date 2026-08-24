import type { Metadata } from 'next';
import { PageHero } from '@/components/site/SiteChrome';

export const metadata: Metadata = {
  title: 'Our Beliefs',
  description: 'The doctrinal foundation on which this ministry platform is built.',
};

const BELIEFS = [
  {
    title: 'The Scriptures',
    body: 'We believe the Bible to be the inspired Word of God, wholly trustworthy, and the final authority for faith, doctrine and Christian living.',
    refs: '2 Timothy 3:16–17 · 2 Peter 1:20–21',
  },
  {
    title: 'God',
    body: 'We believe in one God, eternally existing in three persons — Father, Son and Holy Spirit — perfect in holiness, love, wisdom and power.',
    refs: 'Deuteronomy 6:4 · Matthew 28:19',
  },
  {
    title: 'Jesus Christ',
    body: 'We believe in the deity of Jesus Christ, His virgin birth, sinless life, atoning death, bodily resurrection, ascension, and personal return in power and glory.',
    refs: 'John 1:1–14 · 1 Corinthians 15:3–8',
  },
  {
    title: 'The Holy Spirit',
    body: 'We believe the Holy Spirit indwells, seals, empowers and gifts believers for holy living, witness and service, and that His work continues in the church today.',
    refs: 'Acts 1:8 · Romans 8:9–17',
  },
  {
    title: 'Salvation',
    body: 'We believe salvation is by grace alone, through faith alone, in Christ alone — not by works — issuing in repentance, new birth and a transformed life.',
    refs: 'Ephesians 2:8–10 · Titus 3:4–7',
  },
  {
    title: 'The Church',
    body: 'We believe the church is the body of Christ, called to worship, discipleship, fellowship, service and the proclamation of the gospel to all nations.',
    refs: 'Matthew 28:18–20 · Ephesians 4:11–16',
  },
  {
    title: 'Discipleship and maturity',
    body: 'We believe believers are called not merely to conversion but to maturity — growing in the knowledge of God, in Christian character, and in fruitful ministry.',
    refs: 'Colossians 1:28–29 · Hebrews 5:12–14',
  },
  {
    title: 'Prayer',
    body: 'We believe God hears and answers the prayers of His people, and that intercession is central to the life and mission of the church.',
    refs: 'James 5:16 · 1 Thessalonians 5:16–18',
  },
  {
    title: 'The care of souls',
    body: 'We believe pastoral care is a sacred trust. Those who counsel are accountable to God and to the church for how they handle what is entrusted to them.',
    refs: 'James 3:1 · 1 Peter 5:1–4',
  },
];

export default function BeliefsPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Beliefs"
        title="What we believe"
        description="A summary of the doctrinal convictions that shape the counselling, teaching and discipleship offered here."
      />

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ol className="space-y-10">
          {BELIEFS.map((belief, index) => (
            <li key={belief.title} className="border-l-2 border-gold-400 pl-6">
              <p className="eyebrow mb-2">{String(index + 1).padStart(2, '0')}</p>
              <h2 className="font-serif text-xl font-semibold">{belief.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
                {belief.body}
              </p>
              <p className="mt-3 text-sm italic text-gold-700 dark:text-gold-400">{belief.refs}</p>
            </li>
          ))}
        </ol>

        <p className="mt-14 rounded-xl border border-ink-200 bg-parchment-100 p-6 text-sm leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-parchment-300">
          A deploying organisation can replace this statement with its own confession through the
          administration portal. Doctrinal content is stored as editable policy content, not hardcoded,
          so the church rather than the software decides what it confesses.
        </p>
      </section>
    </>
  );
}
