'use client';

import { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

export interface BarDatum { key: string; label: string; tooltip: string; value: number }

/**
 * Single-series bar chart: one hue, 4px rounded data end on a zero baseline,
 * 2px gaps, recessive grid, hover/focus tooltip and a table view.
 */
export function BarChart({ title, data, color, unit, height = 180, tickEvery = 1 }: {
  title: string; data: BarDatum[]; color: string; unit: string; height?: number; tickEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const ticks = [0, nice / 2, nice];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="panel panel-pad">
      <figcaption className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{total} {unit} in this period</p>
        </div>
        <button className="btn-ghost min-h-[36px] px-2.5 text-xs" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
          {table ? 'Chart' : 'Table'}
        </button>
      </figcaption>

      {table ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="table">
            <thead><tr><th scope="col">Period</th><th scope="col" className="text-right">{unit}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.key}><td>{d.tooltip}</td><td className="text-right tabular-nums">{d.value}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative" style={{ height: height + 24 }}>
          {/* grid + y labels */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: 24 + (t / nice) * height - 7 }}>
              <span className="w-6 text-right text-[11px] tabular-nums text-muted">{t}</span>
              <span className={`h-px flex-1 ${t === 0 ? 'bg-white/25' : 'bg-white/[0.06]'}`} />
            </div>
          ))}
          <div className="absolute bottom-6 left-8 right-0 flex items-end" style={{ height, gap: 2 }}
            onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className="group relative flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.tooltip}: ${d.value} ${unit}`}
              >
                <span
                  className="w-full transition-opacity"
                  style={{
                    height: d.value ? Math.max(3, (d.value / nice) * height) : 0,
                    background: color,
                    borderRadius: '4px 4px 0 0',
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          {/* x labels */}
          <div className="absolute bottom-0 left-8 right-0 flex" style={{ gap: 2 }} aria-hidden>
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 truncate text-center text-[11px] text-muted">
                {i % tickEvery === 0 || i === data.length - 1 ? d.label : ''}
              </span>
            ))}
          </div>
          {hover !== null && (
            <div role="status" className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `calc(2rem + (100% - 2rem) * ${(hover + 0.5) / data.length})` }}>
              <span className="text-muted">{data[hover].tooltip}</span>{' '}
              <span className="font-semibold text-white tabular-nums">{data[hover].value} {unit}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
