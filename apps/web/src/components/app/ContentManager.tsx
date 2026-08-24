'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ResourceRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  topic: string;
  speaker: string | null;
  status: string;
  visibility: string;
  publishedAt: string | null;
  viewCount: number;
  updatedAt: string;
};

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  track: string;
  summary: string;
  status: string;
  visibility: string;
  publishedAt: string | null;
  updatedAt: string;
  lessonCount: number;
  enrolmentCount: number;
};

const RESOURCE_TYPES = [
  'SERMON',
  'BIBLE_STUDY',
  'ARTICLE',
  'VIDEO',
  'AUDIO',
  'PDF',
  'DEVOTIONAL',
  'PRAYER_GUIDE',
  'DISCIPLESHIP_MATERIAL',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * The content management interface.
 *
 * Creating and publishing are separate permissions, and the interface reflects
 * that: someone may be trusted to prepare teaching material without holding the
 * authority to release it to the fellowship.
 */
export function ContentManager({
  resources,
  courses,
  canCreate,
  canPublish,
}: {
  resources: ResourceRow[];
  courses: CourseRow[];
  canCreate: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'resources' | 'courses'>('resources');
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    body: '',
    type: 'ARTICLE',
    topic: '',
    speaker: '',
    mediaUrl: '',
    language: 'en',
    difficulty: 'All levels',
    visibility: 'PUBLIC',
  });
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        slug: form.slug || slugify(form.title),
        body: form.body || undefined,
        speaker: form.speaker || undefined,
        mediaUrl: form.mediaUrl || undefined,
        scriptureRefs: [],
        tags: [],
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'The draft could not be created.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setComposing(false);
    setForm({ ...form, title: '', slug: '', description: '', body: '', topic: '', speaker: '', mediaUrl: '' });
    setBusy(false);
    router.refresh();
  }

  async function setStatusFor(
    target: { resourceId?: string; courseId?: string },
    nextStatus: string,
  ) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, status: nextStatus }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That change could not be made.' },
    );
    setBusy(false);
    router.refresh();
  }

  function StatusBadge({ value }: { value: string }) {
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
          value === 'PUBLISHED'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
            : value === 'REVIEW'
              ? 'bg-gold-100 text-gold-900 dark:bg-gold-950/60 dark:text-gold-200'
              : value === 'ARCHIVED'
                ? 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-parchment-300'
                : 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
        }`}
      >
        {value.toLowerCase()}
      </span>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Content type" className="flex gap-2">
          {[
            { value: 'resources' as const, label: `Resources (${resources.length})` },
            { value: 'courses' as const, label: `Courses (${courses.length})` },
          ].map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setTab(entry.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === entry.value
                  ? 'bg-gold-sheen text-ink-950'
                  : 'border border-ink-300 dark:border-ink-700'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {canCreate && tab === 'resources' ? (
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
          >
            {composing ? 'Cancel' : 'New resource'}
          </button>
        ) : null}
      </div>

      {composing ? (
        <form
          onSubmit={create}
          className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="label">
                Title
              </label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    title: event.target.value,
                    slug: f.slug || slugify(event.target.value),
                  }))
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="slug" className="label">
                Web address
              </label>
              <input
                id="slug"
                required
                pattern="[a-z0-9-]+"
                value={form.slug}
                onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
                className="input font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={2}
              maxLength={1000}
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              className="input resize-y"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="type" className="label">
                Type
              </label>
              <select
                id="type"
                value={form.type}
                onChange={(event) => setForm((f) => ({ ...f, type: event.target.value }))}
                className="input"
              >
                {RESOURCE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="topic" className="label">
                Topic
              </label>
              <input
                id="topic"
                required
                value={form.topic}
                onChange={(event) => setForm((f) => ({ ...f, topic: event.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="visibility" className="label">
                Visibility
              </label>
              <select
                id="visibility"
                value={form.visibility}
                onChange={(event) => setForm((f) => ({ ...f, visibility: event.target.value }))}
                className="input"
              >
                <option value="PUBLIC">Public</option>
                <option value="MEMBERS_ONLY">Members only</option>
                <option value="MINISTRY_CENTER">Ministry centre</option>
                <option value="LEADERSHIP_ONLY">Leadership only</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="speaker" className="label">
                Speaker or author
              </label>
              <input
                id="speaker"
                value={form.speaker}
                onChange={(event) => setForm((f) => ({ ...f, speaker: event.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="mediaUrl" className="label">
                Media link
              </label>
              <input
                id="mediaUrl"
                type="url"
                value={form.mediaUrl}
                onChange={(event) => setForm((f) => ({ ...f, mediaUrl: event.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="body" className="label">
              Body <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <textarea
              id="body"
              rows={8}
              value={form.body}
              onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
              className="input resize-y"
            />
          </div>

          <p className="text-xs text-ink-500 dark:text-parchment-400">
            New content is created as a draft. Publishing is a separate, separately-permissioned act.
          </p>

          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Create draft'}
          </button>
        </form>
      ) : null}

      {tab === 'resources' ? (
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-parchment-100 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-parchment-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Views</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              {resources.map((resource) => (
                <tr key={resource.id} className="bg-white align-top dark:bg-ink-900">
                  <td className="px-4 py-3">
                    <p className="font-medium">{resource.title}</p>
                    <p className="max-w-md truncate text-xs text-ink-500 dark:text-parchment-400">
                      {resource.description}
                    </p>
                    <p className="text-xs text-ink-400 dark:text-parchment-500">
                      /{resource.slug} · {resource.visibility.toLowerCase().replace(/_/g, ' ')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">
                    {resource.type.toLowerCase().replace(/_/g, ' ')}
                    <p className="text-ink-500 dark:text-parchment-400">{resource.topic}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={resource.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{resource.viewCount}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {resource.status !== 'PUBLISHED' && canPublish ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setStatusFor({ resourceId: resource.id }, 'PUBLISHED')}
                          className="rounded-lg bg-gold-sheen px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-60"
                        >
                          Publish
                        </button>
                      ) : null}
                      {resource.status === 'DRAFT' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setStatusFor({ resourceId: resource.id }, 'REVIEW')}
                          className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs disabled:opacity-60 dark:border-ink-700"
                        >
                          Send for review
                        </button>
                      ) : null}
                      {resource.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setStatusFor({ resourceId: resource.id }, 'ARCHIVED')}
                          className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs disabled:opacity-60 dark:border-ink-700"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {resources.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="bg-white px-4 py-12 text-center text-sm text-ink-500 dark:bg-ink-900 dark:text-parchment-400"
                  >
                    No resources yet. Create a draft to begin.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-parchment-100 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-parchment-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Course</th>
                <th scope="col" className="px-4 py-3 font-medium">Track</th>
                <th scope="col" className="px-4 py-3 font-medium">Lessons</th>
                <th scope="col" className="px-4 py-3 font-medium">Enrolments</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              {courses.map((course) => (
                <tr key={course.id} className="bg-white align-top dark:bg-ink-900">
                  <td className="px-4 py-3">
                    <p className="font-medium">{course.title}</p>
                    <p className="max-w-md truncate text-xs text-ink-500 dark:text-parchment-400">
                      {course.summary}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">{course.track}</td>
                  <td className="px-4 py-3 tabular-nums">{course.lessonCount}</td>
                  <td className="px-4 py-3 tabular-nums">{course.enrolmentCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={course.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.status !== 'PUBLISHED' && canPublish ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatusFor({ courseId: course.id }, 'PUBLISHED')}
                        className="rounded-lg bg-gold-sheen px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-60"
                      >
                        Publish
                      </button>
                    ) : course.status === 'PUBLISHED' && canPublish ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatusFor({ courseId: course.id }, 'ARCHIVED')}
                        className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs disabled:opacity-60 dark:border-ink-700"
                      >
                        Archive
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="bg-white px-4 py-12 text-center text-sm text-ink-500 dark:bg-ink-900 dark:text-parchment-400"
                  >
                    No courses yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
