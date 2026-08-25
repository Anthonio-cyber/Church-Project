'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoEmbed } from './VideoEmbed';

export type LessonView = {
  id: string;
  orderIndex: number;
  title: string;
  summary: string;
  body: string;
  scriptureRefs: string[];
  estimatedMinutes: number;
  videoUrl: string | null;
  audioUrl: string | null;
  pdfUrl: string | null;
  completed: boolean;
};

/** Lessons with completion tracking. Progress is recomputed server-side. */
export function LessonList({ courseSlug, lessons }: { courseSlug: string; lessons: LessonView[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(
    lessons.find((lesson) => !lesson.completed)?.id ?? lessons[0]?.id ?? null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleComplete(lesson: LessonView) {
    setBusyId(lesson.id);
    setError(null);

    const response = await fetch(`/api/courses/${courseSlug}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: lesson.id, completed: !lesson.completed }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error?.message ?? 'We could not save your progress.');
      setBusyId(null);
      return;
    }

    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {lessons.map((lesson) => {
        const open = openId === lesson.id;
        return (
          <div
            key={lesson.id}
            className="overflow-hidden rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : lesson.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  lesson.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-parchment-200'
                }`}
              >
                {lesson.completed ? '✓' : lesson.orderIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-base font-semibold">{lesson.title}</span>
                <span className="block text-sm text-ink-500 dark:text-parchment-400">
                  {lesson.summary} · {lesson.estimatedMinutes} min
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-gold-600">
                {open ? '−' : '+'}
              </span>
            </button>

            {open ? (
              <div className="border-t border-ink-200 px-5 py-5 dark:border-ink-800">
                {lesson.scriptureRefs.length > 0 ? (
                  <p className="mb-4 text-sm italic text-gold-700 dark:text-gold-400">
                    {lesson.scriptureRefs.join(' · ')}
                  </p>
                ) : null}

                <div className="prose-sm max-w-none whitespace-pre-wrap text-base leading-relaxed text-ink-700 dark:text-parchment-200">
                  {lesson.body}
                </div>

                {lesson.videoUrl ? (
                  <div className="mt-5">
                    <VideoEmbed url={lesson.videoUrl} title={lesson.title} />
                  </div>
                ) : null}

                {lesson.audioUrl || lesson.pdfUrl ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {lesson.audioUrl ? (
                      <a
                        href={lesson.audioUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg border border-ink-300 px-4 py-2 text-sm dark:border-ink-700"
                      >
                        Listen
                      </a>
                    ) : null}
                    {lesson.pdfUrl ? (
                      <a
                        href={lesson.pdfUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg border border-ink-300 px-4 py-2 text-sm dark:border-ink-700"
                      >
                        Download notes
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => toggleComplete(lesson)}
                  disabled={busyId === lesson.id}
                  className={`mt-6 min-h-[2.75rem] rounded-lg px-5 text-sm font-semibold disabled:opacity-60 ${
                    lesson.completed
                      ? 'border border-ink-300 text-ink-700 dark:border-ink-700 dark:text-parchment-200'
                      : 'bg-gold-sheen text-ink-950'
                  }`}
                >
                  {busyId === lesson.id
                    ? 'Saving…'
                    : lesson.completed
                      ? 'Mark as not complete'
                      : 'Mark lesson complete'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
