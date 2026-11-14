'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CriterionMatrixCompact, dominantReason } from './CriterionMatrix';
import { EmptyState } from './ErrorBoundary';
import { CandidateStatusPill, Pill } from './StatusPill';
import type { PatientAssessment } from '@/lib/api/types';

export function CandidateTable({ trialId, runId, assessments }: { trialId: string; runId: string; assessments: PatientAssessment[] }) {
  const router = useRouter();
  if (!assessments.length) return <EmptyState title="No assessments match these filters">Change the status tab, reason filter or search.</EmptyState>;
  const hrefFor = (pid: string) => `/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(pid)}?run=${encodeURIComponent(runId)}`;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr><th>Patient</th><th>Pre-screen status</th><th>Dominant reason</th><th>Eligibility rules</th><th>Evidence completeness</th><th>Participation</th></tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.assessment_id} className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) router.push(hrefFor(a.patient_id)); }}>
              <td className="whitespace-nowrap">
                <Link className="mono font-semibold text-brand underline-offset-2 hover:underline" href={hrefFor(a.patient_id)}>{a.patient_id}</Link>
                {a.stale && <div><Pill tone="unknown">Stale</Pill></div>}
              </td>
              <td><CandidateStatusPill status={a.candidate_status} /></td>
              <td className="min-w-[14rem] text-xs">{dominantReason(a)}</td>
              <td><CriterionMatrixCompact criteria={a.criteria} /></td>
              <td className="whitespace-nowrap text-xs">{a.evidence_completeness_percent === null ? <span className="text-ink-faint">Not reported</span> : `${a.evidence_completeness_percent}%`}</td>
              <td className="text-xs">{a.participation_status.replace('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
