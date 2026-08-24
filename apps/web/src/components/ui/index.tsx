import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * The shared interface kit.
 *
 * Every state the specification asks for has a component here — loading,
 * empty, error, permission-denied, offline — because a real ministry platform
 * has to tell someone honestly what is happening, especially when they came
 * looking for help.
 */

type Tone = 'gold' | 'neutral' | 'positive' | 'caution' | 'critical' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  gold: 'bg-gold-100 text-gold-900 ring-gold-300 dark:bg-gold-950/60 dark:text-gold-200 dark:ring-gold-800',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-300 dark:bg-ink-800 dark:text-parchment-200 dark:ring-ink-700',
  positive: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900',
  caution: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900',
  critical: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900',
  info: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'neutral', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const colour =
    tone === 'positive'
      ? 'bg-emerald-500'
      : tone === 'critical'
        ? 'bg-red-500'
        : tone === 'caution'
          ? 'bg-amber-500'
          : tone === 'gold'
            ? 'bg-gold-500'
            : 'bg-ink-400';
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 rounded-full ${colour} ${pulse ? 'animate-pulse-soft' : ''}`}
    />
  );
}

export function Card({
  children,
  className = '',
  as: Component = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Component className={`card ${className}`}>{children}</Component>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function GoldRule({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`gold-rule ${className}`} />;
}

/** A stat tile for dashboards. Numbers only — never record content. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-parchment-400">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
          <Badge tone={tone}>{hint}</Badge>
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = '✦',
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-parchment-100/60 px-6 py-12 text-center dark:border-ink-700 dark:bg-ink-900/40">
      <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
        {icon}
      </p>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  retry,
}: {
  title?: string;
  description: string;
  retry?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900 dark:bg-red-950/40"
    >
      <h3 className="font-serif text-lg font-semibold text-red-900 dark:text-red-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-red-800 dark:text-red-300">{description}</p>
      {retry ? <div className="mt-5">{retry}</div> : null}
    </div>
  );
}

/**
 * Shown when someone reaches a surface their role does not permit. It explains
 * the boundary rather than pretending the page does not exist, because on this
 * platform the boundaries are deliberate and worth stating.
 */
export function PermissionDenied({
  what = 'this area',
  detail,
}: {
  what?: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-ink-200 bg-white px-6 py-10 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
      <p aria-hidden className="mb-3 text-3xl">
        🔒
      </p>
      <h1 className="font-serif text-xl font-semibold">You do not have access to {what}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
        {detail ??
          'Access on this platform follows the church’s approved leadership structure and the principle of least privilege. If you believe you should have access, speak with your supervising leader.'}
      </p>
      <div className="mt-6">
        <ButtonLink href="/app/dashboard" variant="secondary">
          Back to your dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse-soft rounded-xl bg-ink-100 dark:bg-ink-800"
        />
      ))}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-sheen text-ink-950 font-semibold shadow-gold hover:brightness-105 active:brightness-95',
  secondary:
    'border border-ink-300 bg-white text-ink-800 hover:border-gold-400 hover:text-gold-800 dark:border-ink-700 dark:bg-ink-900 dark:text-parchment-100',
  ghost: 'text-ink-700 hover:bg-ink-100 dark:text-parchment-200 dark:hover:bg-ink-800',
  danger: 'bg-red-600 text-white font-semibold hover:bg-red-700',
};

const BUTTON_BASE =
  'inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60';

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_CLASSES[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: ButtonVariant = 'primary', className = '') {
  return `${BUTTON_BASE} ${BUTTON_CLASSES[variant]} ${className}`;
}

/** A prominent, repeated safeguarding notice. */
export function SafeguardingNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 ${
        compact ? 'px-4 py-3' : 'px-5 py-4'
      }`}
    >
      <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
        <strong className="font-semibold">Not an emergency service.</strong> Online pastoral
        counselling is not a substitute for emergency, medical, psychological, psychiatric or legal
        services. If you are in immediate danger, contact appropriate local emergency or
        professional services.
      </p>
    </aside>
  );
}
