'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ProfileValues = {
  displayName: string;
  bio: string;
  country: string;
  timezone: string;
  preferredLanguage: string;
  interests: string[];
};

export type PrivacyValues = {
  discoverable: boolean;
  whoCanRequestConnection: string;
  publicProfile: boolean;
  allowPrayerInteraction: boolean;
  showOnlineStatus: boolean;
  allowCounsellorFollowUp: boolean;
  allowCenterDiscovery: boolean;
};

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [interestDraft, setInterestDraft] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'We could not save your profile.' },
    );
    setBusy(false);
    if (response?.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {status ? (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            status.tone === 'ok'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <div>
        <label htmlFor="displayName" className="label">
          Display name
        </label>
        <input
          id="displayName"
          value={values.displayName}
          onChange={(event) => setValues((v) => ({ ...v, displayName: event.target.value }))}
          className="input"
          maxLength={40}
        />
        <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
          This is what other members see. Your legal name is never shown to them.
        </p>
      </div>

      <div>
        <label htmlFor="bio" className="label">
          About you <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          rows={4}
          maxLength={600}
          value={values.bio}
          onChange={(event) => setValues((v) => ({ ...v, bio: event.target.value }))}
          className="input resize-y"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="country" className="label">
            Country
          </label>
          <input
            id="country"
            value={values.country}
            onChange={(event) => setValues((v) => ({ ...v, country: event.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="timezone" className="label">
            Time zone
          </label>
          <input
            id="timezone"
            value={values.timezone}
            onChange={(event) => setValues((v) => ({ ...v, timezone: event.target.value }))}
            className="input"
            placeholder="e.g. Africa/Lagos"
          />
          <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
            Session times are shown in this zone.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="preferredLanguage" className="label">
          Preferred language
        </label>
        <select
          id="preferredLanguage"
          value={values.preferredLanguage}
          onChange={(event) => setValues((v) => ({ ...v, preferredLanguage: event.target.value }))}
          className="input"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="sw">Kiswahili</option>
        </select>
      </div>

      <div>
        <label htmlFor="interestDraft" className="label">
          Christian interests
        </label>
        <div className="flex gap-2">
          <input
            id="interestDraft"
            value={interestDraft}
            onChange={(event) => setInterestDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const trimmed = interestDraft.trim();
                if (trimmed && values.interests.length < 12) {
                  setValues((v) => ({ ...v, interests: [...v.interests, trimmed] }));
                  setInterestDraft('');
                }
              }
            }}
            placeholder="Add an interest and press Enter"
            className="input flex-1"
            maxLength={40}
          />
        </div>
        {values.interests.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {values.interests.map((interest, index) => (
              <li key={`${interest}-${index}`}>
                <button
                  type="button"
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      interests: v.interests.filter((_, i) => i !== index),
                    }))
                  }
                  className="rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-sm text-gold-900 dark:border-gold-800 dark:bg-gold-950/40 dark:text-gold-200"
                >
                  {interest} <span aria-hidden>×</span>
                  <span className="sr-only">Remove {interest}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 text-sm font-semibold text-ink-950 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

const PRIVACY_TOGGLES: [keyof PrivacyValues, string, string][] = [
  ['discoverable', 'Who can find me?', 'Allow other members to find you by display name in search.'],
  ['publicProfile', 'Show profile publicly?', 'Allow your profile to be viewed by other members.'],
  ['allowPrayerInteraction', 'Allow prayer interaction?', 'Be told when someone prays for your request.'],
  ['showOnlineStatus', 'Show online status?', 'Let connections see when you are active.'],
  ['allowCounsellorFollowUp', 'Allow counsellor follow-up?', 'Let a counsellor contact you after a session.'],
  ['allowCenterDiscovery', 'Allow ministry-centre discovery?', 'Be listed among your centre’s members.'],
];

export function PrivacyForm({ initial }: { initial: PrivacyValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function save(next: PrivacyValues) {
    setValues(next);
    setStatus('Saving…');
    const response = await fetch('/api/privacy/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => null);
    setStatus(response?.ok ? 'Saved.' : 'We could not save that change.');
    if (response?.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="whoCanRequestConnection" className="label">
          Who can request to connect with me?
        </label>
        <select
          id="whoCanRequestConnection"
          value={values.whoCanRequestConnection}
          onChange={(event) =>
            save({ ...values, whoCanRequestConnection: event.target.value })
          }
          className="input"
        >
          <option value="MEMBERS">Any member</option>
          <option value="MINISTRY_CENTER">Only members of my ministry centre</option>
          <option value="NOBODY">Nobody</option>
        </select>
      </div>

      {PRIVACY_TOGGLES.map(([key, label, description]) => (
        <label key={key} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={values[key] as boolean}
            onChange={(event) => save({ ...values, [key]: event.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-gold-600"
          />
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-ink-500 dark:text-parchment-400">{description}</span>
          </span>
        </label>
      ))}

      {status ? (
        <p role="status" className="text-xs text-ink-500 dark:text-parchment-400">
          {status}
        </p>
      ) : null}
    </div>
  );
}
