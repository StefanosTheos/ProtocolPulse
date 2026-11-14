'use client';

import { CriterionStatusPill } from './StatusPill';
import { formatInstant } from '@/lib/api/time';
import type { Criterion, CriterionResult, PatientAssessment } from '@/lib/api/types';

// Summarises backend criterion outcomes; never recomputes them.
export function dominantReason(a: PatientAssessment): string {
  if (a.evaluation_state === 'EVALUATION_ERROR') return 'Operational evaluation error (no authoritative status)';
  const failed = a.criteria.filter((c) => c.status === 'FAIL');
  if (failed.length) return `${failed.map((c) => c.criterion_id).join(', ')} failed`;
  const unknown = a.criteria.filter((c) => c.status === 'UNKNOWN');
  if (unknown.length) return unknown.map((c) => `${c.criterion_id}: ${c.reason_codes.join(', ') || 'unknown'}`).join('; ');
  return `All ${a.criteria.length} evaluated rules pass`;
}

export function CriterionMatrixCompact({ criteria }: { criteria: CriterionResult[] }) {
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Criterion results">
      {criteria.map((c) => (
        <li key={c.criterion_id} className="flex items-center gap-1 rounded border border-line px-1 py-0.5">
          <span className="mono text-2xs text-ink-muted">{c.criterion_id.replace('PX-', '')}</span>
          <CriterionStatusPill status={c.status} />
        </li>
      ))}
    </ul>
  );
}

export function CriterionMatrix({ results, criteriaById, selectedId, onSelect }: {
  results: CriterionResult[]; criteriaById: Record<string, Criterion>; selectedId: string | null; onSelect: (criterionId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Rule</th><th>Result</th><th>Why</th><th>Window considered</th><th>Evidence</th></tr></thead>
        <tbody>
          {results.map((r) => {
            const rule = criteriaById[r.criterion_id];
            const selected = r.criterion_id === selectedId;
            return (
              <tr key={r.criterion_result_id} aria-selected={selected || undefined} className={selected ? 'bg-brand-soft' : undefined}>
                <td className="whitespace-nowrap">
                  <div className="mono font-semibold">{r.criterion_id}</div>
                  {rule && <div className="text-2xs text-ink-faint">{rule.type} · {rule.clinical_subject}</div>}
                </td>
                <td className="whitespace-nowrap">
                  <CriterionStatusPill status={r.status} />
                  {r.reason_codes.length > 0 && <div className="mono mt-1 text-2xs text-unknown-fg">{r.reason_codes.join(', ')}</div>}
                </td>
                <td className="min-w-[16rem]">{r.explanation}</td>
                <td className="whitespace-nowrap text-xs">
                  {r.considered_interval ? <>{formatInstant(r.considered_interval.start)}<br />→ {formatInstant(r.considered_interval.end)}</> : <span className="text-ink-faint">Point-in-time</span>}
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
