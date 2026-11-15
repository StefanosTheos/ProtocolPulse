'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CriterionSummary } from './CriterionMatrix';
import { EmptyState } from './ErrorBoundary';
import { CandidateStatusPill, Pill } from './StatusPill';
import { plainReason } from '@/lib/api/labels';
import type { Criterion, PatientAssessment } from '@/lib/api/types';

export function CandidateTable({ trialId, runId, assessments, criteriaById = {} }: {
  trialId: string; runId: string; assessments: PatientAssessment[]; criteriaById?: Record<string, Criterion>;
}) {
  const router = useRouter();
  if (!assessments.length) return <EmptyState title="No patients match">Choose another result, clear the reason filter or clear the search.</EmptyState>;
  const hrefFor = (pid: string) => `/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(pid)}?run=${encodeURIComponent(runId)}`;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr><th>Patient</th><th>Result</th><th>Why</th><th>Criteria</th></tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.assessment_id} className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) router.push(hrefFor(a.patient_id)); }}>
              <td className="whitespace-nowrap">
                <Link className="font-bold text-brand underline-offset-2 hover:underline" href={hrefFor(a.patient_id)}>{a.patient_id}</Link>
                {a.stale && <div><Pill tone="unknown">Out of date</Pill></div>}
              </td>
              <td><CandidateStatusPill status={a.candidate_status} /></td>
              <td className="min-w-[16rem]">{plainReason(a, criteriaById)}</td>
              <td><CriterionSummary criteria={a.criteria} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
