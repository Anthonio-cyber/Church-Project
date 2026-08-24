import type { RiskLevel, SafeguardingCategory } from '@prisma/client';

/**
 * Lightweight safeguarding triage.
 *
 * This is a signal, not a diagnosis. Its only job is to make sure that when
 * someone describes danger in a counselling request or report, the platform
 * responds immediately with the right professional-help message and routes the
 * matter to a safeguarding lead — rather than leaving it in an ordinary queue.
 *
 * It never blocks a member from submitting their request, and it never
 * classifies a person. A human safeguarding lead makes every real decision.
 */

type Signal = {
  category: SafeguardingCategory;
  risk: RiskLevel;
  patterns: RegExp[];
};

const SIGNALS: Signal[] = [
  {
    category: 'SELF_HARM_CONCERN',
    risk: 'CRITICAL',
    patterns: [
      /\bkill myself\b/i,
      /\bend my life\b/i,
      /\btake my (own )?life\b/i,
      /\bsuicid(e|al)\b/i,
      /\bself[- ]?harm\b/i,
      /\bcut(ting)? myself\b/i,
      /\bdon'?t want to (live|be here)\b/i,
      /\boverdos(e|ing)\b/i,
    ],
  },
  {
    category: 'CHILD_SAFETY',
    risk: 'CRITICAL',
    patterns: [
      /\bchild (abuse|neglect)\b/i,
      /\bmy child is (being )?(hurt|beaten|touched)\b/i,
      /\bunderage\b/i,
      /\bgroom(ing|ed)\b/i,
    ],
  },
  {
    category: 'ABUSE',
    risk: 'HIGH',
    patterns: [
      /\b(he|she|they) (beats?|hits?|punches?|strangl\w*) me\b/i,
      /\bdomestic (abuse|violence)\b/i,
      /\bafraid (for my life|of (him|her|them))\b/i,
      /\bbeing abused\b/i,
    ],
  },
  {
    category: 'THREATS',
    risk: 'HIGH',
    patterns: [
      /\bthreaten(ed|ing)? to (kill|hurt|harm)\b/i,
      /\bsomeone (is )?(stalking|following) me\b/i,
      /\bdeath threat\b/i,
    ],
  },
  {
    category: 'SEXUAL_MISCONDUCT',
    risk: 'HIGH',
    patterns: [/\brape[d]?\b/i, /\bsexual(ly)? assault(ed)?\b/i, /\bmolest(ed|ation)\b/i],
  },
  {
    category: 'EXPLOITATION',
    risk: 'MEDIUM',
    patterns: [/\btrafficked?\b/i, /\bforced to work\b/i, /\bheld against my will\b/i],
  },
  {
    category: 'FINANCIAL_EXPLOITATION',
    risk: 'MEDIUM',
    patterns: [
      /\bsend (me )?money\b/i,
      /\bgift ?cards?\b/i,
      /\binvestment opportunity\b/i,
      /\bcrypto (investment|profit)\b/i,
    ],
  },
];

export type TriageResult = {
  flagged: boolean;
  category?: SafeguardingCategory;
  risk?: RiskLevel;
  /** Shown to the member immediately, before anything else happens. */
  memberMessage?: string;
};

const CRISIS_MESSAGE =
  'What you have described sounds serious, and we want you to be safe. ' +
  'Online pastoral counselling is not an emergency service. If you are in ' +
  'immediate danger, or you are thinking about harming yourself or someone ' +
  'else, please contact your local emergency services or a crisis line in your ' +
  'country right now. A member of our safeguarding team has been notified and ' +
  'will follow up with you.';

const CONCERN_MESSAGE =
  'Thank you for trusting us with this. Because of what you have described, a ' +
  'safeguarding lead will review your request alongside the counselling team. ' +
  'Pastoral counselling sits alongside — not instead of — professional help, ' +
  'and we would encourage you to contact appropriate local services as well.';

export function triage(text: string): TriageResult {
  for (const signal of SIGNALS) {
    if (signal.patterns.some((pattern) => pattern.test(text))) {
      return {
        flagged: true,
        category: signal.category,
        risk: signal.risk,
        memberMessage:
          signal.risk === 'CRITICAL' ? CRISIS_MESSAGE : CONCERN_MESSAGE,
      };
    }
  }
  return { flagged: false };
}

export const EMERGENCY_NOTICE =
  'Online pastoral counselling is not an emergency service. If you are in ' +
  'immediate danger, contact appropriate local emergency or professional services.';

export const COUNSELLING_DISCLAIMER =
  'Pastoral counselling provides spiritual guidance, prayer, biblical ' +
  'encouragement and pastoral support. It is not a substitute for emergency ' +
  'services, licensed medical care, psychological treatment, psychiatric ' +
  'treatment, legal advice or other professional services.';
