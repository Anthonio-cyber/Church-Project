/**
 * Small, dependency-free charts for the administrative dashboards.
 *
 * They plot counts only — user growth, counselling demand, report trends. No
 * chart on this platform is ever fed record-level or counselling data, so these
 * deliberately accept nothing but a label and a number.
 */

export type Point = { label: string; value: number };

const SERIES_COLOURS = ['#c9922a', '#89551d', '#e8c469', '#67625b', '#ab7220'];

export function BarChart({
  data,
  title,
  description,
  height = 160,
}: {
  data: Point[];
  title: string;
  description?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <figcaption className="mb-1 font-serif text-base font-semibold">{title}</figcaption>
      {description ? (
        <p className="mb-4 text-xs text-ink-500 dark:text-parchment-400">{description}</p>
      ) : null}

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-500 dark:text-parchment-400">
          No data for this period yet.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-1" style={{ height }}>
            {data.map((point) => (
              <div key={point.label} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[0.65rem] font-medium tabular-nums text-ink-600 dark:text-parchment-300">
                  {point.value}
                </span>
                <div
                  className="w-full rounded-t bg-gold-sheen"
                  style={{ height: `${Math.max(2, (point.value / max) * (height - 24))}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            {data.map((point) => (
              <span
                key={point.label}
                className="flex-1 truncate text-center text-[0.6rem] text-ink-500 dark:text-parchment-400"
              >
                {point.label}
              </span>
            ))}
          </div>
          {/* A table alternative, so the figure is not lost to a screen reader. */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-ink-500 dark:text-parchment-400">
              View as a table
            </summary>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500 dark:text-parchment-400">
                  <th scope="col" className="py-1">
                    Period
                  </th>
                  <th scope="col" className="py-1 text-right">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.label} className="border-t border-ink-200 dark:border-ink-800">
                    <td className="py-1">{point.label}</td>
                    <td className="py-1 text-right tabular-nums">{point.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  );
}

export function DistributionBar({
  data,
  title,
  description,
}: {
  data: Point[];
  title: string;
  description?: string;
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <figcaption className="mb-1 font-serif text-base font-semibold">{title}</figcaption>
      {description ? (
        <p className="mb-4 text-xs text-ink-500 dark:text-parchment-400">{description}</p>
      ) : null}

      {total === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500 dark:text-parchment-400">
          No data yet.
        </p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full">
            {data.map((point, index) => (
              <div
                key={point.label}
                style={{
                  width: `${(point.value / total) * 100}%`,
                  backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length],
                }}
                title={`${point.label}: ${point.value}`}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {data.map((point, index) => (
              <li key={point.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length] }}
                  />
                  <span className="capitalize text-ink-700 dark:text-parchment-200">
                    {point.label.toLowerCase().replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{point.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}
