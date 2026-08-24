import type { ReactNode } from 'react';
import { PageHero } from './SiteChrome';
import { GoldRule } from '@/components/ui';

export type PolicySection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
};

/**
 * Shared layout for the policy pages.
 *
 * Every policy page carries the same configurability notice: the wording here
 * is a workable starting point written in plain language, but the final legal
 * text belongs to the organisation's legal and privacy advisers, and is stored
 * as versioned policy content rather than hardcoded.
 */
export function PolicyPage({
  eyebrow,
  title,
  description,
  version,
  effectiveFrom,
  sections,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  version: string;
  effectiveFrom: string;
  sections: PolicySection[];
  children?: ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="mb-10 text-sm text-ink-500 dark:text-parchment-400">
          Version {version} · Effective from {effectiveFrom}
        </p>

        {children}

        <div className="space-y-10">
          {sections.map((section, index) => (
            <section key={section.heading}>
              <h2 className="font-serif text-xl font-semibold">
                <span className="mr-3 text-gold-600">{String(index + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-4 text-base leading-relaxed text-ink-700 dark:text-parchment-200"
                >
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-4 space-y-2">
                  {section.list.map((item) => (
                    <li
                      key={item.slice(0, 40)}
                      className="flex gap-3 text-base leading-relaxed text-ink-700 dark:text-parchment-200"
                    >
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <GoldRule className="my-12" />

        <aside className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong className="font-semibold">This wording is configurable, and should be reviewed.</strong>{' '}
          It is written in plain language as a working starting point, not as legal advice. The
          deploying organisation’s legal and privacy advisers should review and replace it. Policies
          are stored as versioned content in the platform, and each member’s consent is recorded
          against the specific version they agreed to — so amending a policy does not silently
          rewrite what people previously consented to.
        </aside>
      </article>
    </>
  );
}
