'use client';

import { CriterionStatusPill } from './StatusPill';
import { REASON_LABEL, REASON_RESOLVE, criteriaSummary, criterionName, plainText, sentenceCase } from '@/lib/api/labels';
import { formatInstant } from '@/lib/api/time';
import type { Criterion, CriterionResult } from '@/lib/api/types';

const ORDER: Record<CriterionResult['status'], number> = { FAIL: 0, UNKNOWN: 1, PASS: 2 };

// One-line count of backend criterion outcomes; never recomputes them.
export function CriterionSummary({ criteria }: { criteria: CriterionResult[] }) {
  return <span className="whitespace-nowrap text-ink-muted">{criteriaSummary(criteria)}</span>;
}

// Criteria that are not met or unclear come first: they are what the reviewer has to act on.
export function CriterionMatrix({ results, criteriaById, selectedId, onSelect }: {
  results: CriterionResult[]; criteriaById: Record<string, Criterion>; selectedId: string | null; onSelect: (criterionId: string) => void;
}) {
  const ordered = [...results].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Criterion</th><th>Result</th><th>Why</th><th>Period considered</th><th>Evidence</th></tr></thead>
        <tbody>
          {ordered.map((r) => {
            const selected = r.criterion_id === selectedId;
            return (
              <tr key={r.criterion_result_id} aria-selected={selected || undefined} className={selected ? 'bg-brand-soft' : undefined}>
                <td className="font-semibold">{criterionName(criteriaById[r.criterion_id], r.criterion_id)}</td>
                <td className="whitespace-nowrap"><CriterionStatusPill status={r.status} /></td>
                <td className="min-w-[16rem]">
                  {plainText(r.explanation)}
                  {r.reason_codes.map((code) => (
                    <div key={code} className="mt-1 text-unknown-fg">
                      <span className="font-semibold">{REASON_LABEL[code] ?? sentenceCase(code)}.</span>
                      {r.status === 'UNKNOWN' && REASON_RESOLVE[code] ? <> To resolve: {REASON_RESOLVE[code]}</> : null}
                    </div>
                  ))}
                </td>
                <td className="whitespace-nowrap text-xs">
                  {r.considered_interval ? <>{formatInstant(r.considered_interval.start)}<br />→ {formatInstant(r.considered_interval.end)}</> : <span className="text-ink-faint">On the screening date</span>}
                </td>
                <td>
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" aria-pressed={selected} onClick={() => onSelect(r.criterion_id)}>
                    {r.evidence_refs.length} source{r.evidence_refs.length === 1 ? '' : 's'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
