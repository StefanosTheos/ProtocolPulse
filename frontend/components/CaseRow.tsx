import Link from 'next/link';
import { CaseStatusPill, PriorityPill } from './StatusPill';
import { formatInstant } from '@/lib/api/time';
import type { ReviewCase } from '@/lib/api/types';

export function CaseRow({ trialId, reviewCase: c, selected, onSelect }: {
  trialId: string; reviewCase: ReviewCase; selected?: boolean; onSelect?: (caseId: string) => void;
}) {
  const href = `/trials/${encodeURIComponent(trialId)}/cases?case=${encodeURIComponent(c.case_id)}`;
  return (
    <tr aria-selected={selected || undefined} className={selected ? 'bg-brand-soft' : undefined}>
      <td>
        {onSelect
          ? <button type="button" className="mono text-left text-brand underline-offset-2 hover:underline" onClick={() => onSelect(c.case_id)}>{c.case_id}</button>
          : <Link className="mono text-brand underline-offset-2 hover:underline" href={href}>{c.case_id}</Link>}
      </td>
      <td>
        <Link className="mono text-brand underline-offset-2 hover:underline" href={`/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(c.patient_id)}`}>{c.patient_id}</Link>
      </td>
      <td className="mono">{c.criterion_id}</td>
      <td><CaseStatusPill status={c.status} /></td>
      <td><PriorityPill priority={c.priority} /></td>
      <td className="mono">{c.assigned_actor_id ?? <span className="text-ink-faint">Unassigned</span>}</td>
      <td className="whitespace-nowrap text-xs">{formatInstant(c.updated_at)}</td>
    </tr>
  );
}
