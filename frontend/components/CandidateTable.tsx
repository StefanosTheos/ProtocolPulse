'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CriterionSummary } from './CriterionMatrix';
import { EmptyState } from './ErrorBoundary';
import { CandidateStatusPill, Pill } from './StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { plainReason } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { Criterion, ParticipationStatus, PatientAssessment } from '@/lib/api/types';

function ParticipationCell({ status, loading }: { status: ParticipationStatus | undefined; loading: boolean }) {
  if (status === 'PARTICIPATING') return <Pill tone="pass">Participating</Pill>;
  if (status === 'ENDED') return <Pill tone="neutral">Participation ended</Pill>;
  if (status === 'NOT_ENROLLED') return <span className="text-ink-muted">Not participating</span>;
  return <span className="text-ink-faint">{loading ? 'Loading…' : 'Unavailable'}</span>;
}

export function CandidateTable({ trialId, runId, assessments, criteriaById = {} }: {
  trialId: string; runId: string; assessments: PatientAssessment[]; criteriaById?: Record<string, Criterion>;
}) {
  const router = useRouter();
  // Assessments keep participation as it was at screening time, so the current status is read from each patient.
  const patientIds = assessments.map((a) => a.patient_id);
  const participation = useApiQuery(async () => {
    const results = await Promise.allSettled(patientIds.map((id) => getApi().getPatient360(trialId, id)));
    const byId: Record<string, ParticipationStatus> = {};
    results.forEach((r, i) => { if (r.status === 'fulfilled') byId[patientIds[i]] = r.value.data.participation_status; });
    return byId;
  }, [trialId, patientIds.join(',')]);
  if (!assessments.length) return <EmptyState title="No patients match">Choose another result, clear the reason filter or clear the search.</EmptyState>;
  const hrefFor = (pid: string) => `/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(pid)}?run=${encodeURIComponent(runId)}`;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr><th>Patient</th><th>Result</th><th>Why</th><th>Criteria</th><th>Participation now</th></tr>
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
              <td className="whitespace-nowrap"><ParticipationCell status={participation.data?.[a.patient_id]} loading={participation.loading} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
