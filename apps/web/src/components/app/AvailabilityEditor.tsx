'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Slot = { weekday: number; startMinute: number; endMinute: number; state: string };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Recurring weekly availability plus a current state a counsellor can flip. */
export function AvailabilityEditor({
  initialState,
  initialCapacity,
  initialSlots,
}: {
  initialState: string;
  initialCapacity: number;
  initialSlots: Slot[];
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/counsellor/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availabilityState: state, maxConcurrentCases: capacity, slots }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'Could not save your availability.' },
    );
    setBusy(false);
    if (response?.ok) router.refresh();
  }

  return (
    <div className="space-y-8">
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

      <section className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <h2 className="mb-4 font-serif text-lg font-semibold">Right now</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="availabilityState" className="label">
              Current state
            </label>
            <select
              id="availabilityState"
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="input"
            >
              <option value="AVAILABLE">Available</option>
              <option value="BUSY">Busy</option>
              <option value="BREAK">On a break</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
              Members see this as your availability when a request is being matched.
            </p>
          </div>

          <div>
            <label htmlFor="capacity" className="label">
              Maximum concurrent cases
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              className="input"
            />
            <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
              The platform refuses new sessions beyond this. Pastoral care done badly because you
              are overloaded helps nobody.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">Weekly availability</h2>
          <button
            type="button"
            onClick={() =>
              setSlots((current) => [
                ...current,
                { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60, state: 'AVAILABLE' },
              ])
            }
            className="rounded-lg border border-ink-300 px-4 py-2 text-sm dark:border-ink-700"
          >
            Add a slot
          </button>
        </div>

        {slots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No recurring availability set. Add slots so the counselling team knows when to schedule
            you.
          </p>
        ) : (
          <ul className="space-y-3">
            {slots.map((slot, index) => (
              <li
                key={index}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-ink-200 p-3 dark:border-ink-800"
              >
                <div className="min-w-[8rem] flex-1">
                  <label htmlFor={`weekday-${index}`} className="label">
                    Day
                  </label>
                  <select
                    id={`weekday-${index}`}
                    value={slot.weekday}
                    onChange={(event) =>
                      setSlots((current) =>
                        current.map((s, i) =>
                          i === index ? { ...s, weekday: Number(event.target.value) } : s,
                        ),
                      )
                    }
                    className="input"
                  >
                    {WEEKDAYS.map((day, dayIndex) => (
                      <option key={day} value={dayIndex}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`start-${index}`} className="label">
                    From
                  </label>
                  <input
                    id={`start-${index}`}
                    type="time"
                    value={toTime(slot.startMinute)}
                    onChange={(event) =>
                      setSlots((current) =>
                        current.map((s, i) =>
                          i === index ? { ...s, startMinute: toMinutes(event.target.value) } : s,
                        ),
                      )
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor={`end-${index}`} className="label">
                    To
                  </label>
                  <input
                    id={`end-${index}`}
                    type="time"
                    value={toTime(slot.endMinute)}
                    onChange={(event) =>
                      setSlots((current) =>
                        current.map((s, i) =>
                          i === index ? { ...s, endMinute: toMinutes(event.target.value) } : s,
                        ),
                      )
                    }
                    className="input"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
                  className="min-h-[2.75rem] rounded-lg border border-red-300 px-4 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 text-sm font-semibold text-ink-950 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save availability'}
      </button>
    </div>
  );
}
