import Link from 'next/link';
import { CaseStatusPill, PriorityPill } from './StatusPill';
import { ROLE_LABEL, caseIssue } from '@/lib/api/labels';
import { actorById } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { ReviewCase } from '@/lib/api/types';

export function CaseRow({ trialId, reviewCase: c, selected, onSelect }: {
  trialId: string; reviewCase: ReviewCase; selected?: boolean; onSelect?: (caseId: string) => void;
}) {
  const base = `/trials/${encodeURIComponent(trialId)}`;
  const owner = c.assigned_actor_id ? actorById(c.assigned_actor_id) : undefined;
  return (
    <tr aria-selected={selected || undefined} className={selected ? 'bg-brand-soft' : undefined}>
      <td className="whitespace-nowrap">
        <Link className="font-bold text-brand underline-offset-2 hover:underline" href={`${base}/patients/${encodeURIComponent(c.patient_id)}`}>{c.patient_id}</Link>
      </td>
      <td className="min-w-[12rem]">{caseIssue(c.current_summary)}</td>
      <td><CaseStatusPill status={c.status} /></td>
      <td><PriorityPill priority={c.priority} /></td>
      <td>{owner ? ROLE_LABEL[owner.role] : c.assigned_actor_id ? 'Assigned' : <span className="text-ink-faint">Unassigned</span>}</td>
      <td className="whitespace-nowrap text-xs">{formatInstant(c.updated_at)}</td>
      <td className="whitespace-nowrap">
        {onSelect
          ? <button type="button" className="btn-secondary px-2 py-1 text-xs" aria-label={`Case ${c.case_id}`} onClick={() => onSelect(c.case_id)}>Review</button>
          : <Link className="btn-secondary px-2 py-1 text-xs" aria-label={`Case ${c.case_id}`} href={`${base}/cases?case=${encodeURIComponent(c.case_id)}`}>Review</Link>}
      </td>
    </tr>
  );
}

export function CaseTable({ trialId, cases, selectedId, onSelect }: {
  trialId: string; cases: ReviewCase[]; selectedId?: string | null; onSelect?: (caseId: string) => void;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Patient</th><th>Issue</th><th>Status</th><th>Priority</th><th>Assigned to</th><th>Updated</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{cases.map((c) => <CaseRow key={c.case_id} trialId={trialId} reviewCase={c} selected={c.case_id === selectedId} onSelect={onSelect} />)}</tbody>
      </table>
    </div>
  );
}
