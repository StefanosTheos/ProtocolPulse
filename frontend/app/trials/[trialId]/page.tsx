'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useActor } from '@/components/ActorContext';
import { CaseTable } from '@/components/CaseRow';
import { ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { CAN_READ, ROLE_LABEL, STEPS, caseIssue } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { ActorRole, Page, ReviewCase } from '@/lib/api/types';

function countLabel(page: Page<unknown>['page'], shown: number): string {
  if (page.total_count !== null) return String(page.total_count);
  return page.next_cursor ? `${shown}+` : String(shown);
}

interface AttentionItem { tone: 'urgent' | 'warn' | 'info'; title: string; detail: string; cta: string; href: string }
const TONE: Record<AttentionItem['tone'], string> = {
  urgent: 'border-fail-line bg-fail-bg',
  warn: 'border-unknown-line bg-unknown-bg',
  info: 'border-line bg-canvas',
};
const is = (role: ActorRole, ...roles: ActorRole[]) => roles.includes(role);

export default function TrialOverviewPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const protocols = useApiQuery(() => getApi().listProtocols(trialId, { sort: '-created_at', limit: 10 }).then((r) => r.data), [trialId, actor.actor_id]);
  const readsCases = CAN_READ.cases.includes(actor.role);
  const openCases = useApiQuery(readsCases ? () => getApi().listCases(trialId, { status: 'OPEN', sort: '-updated_at', limit: 5 }).then((r) => r.data) : null, [trialId, actor.actor_id, readsCases]);
  const reopened = useApiQuery(readsCases ? () => getApi().listCases(trialId, { status: 'REOPENED', limit: 5 }).then((r) => r.data) : null, [trialId, actor.actor_id, readsCases]);
  const hasStep = (key: string) => STEPS.some((s) => s.key === key && s.roles.includes(actor.role));

  const base = `/trials/${encodeURIComponent(trialId)}`;
  const role = actor.role;
  const latest = protocols.data?.items[0] ?? null;
  const active = protocols.data?.items.find((p) => p.state === 'ACTIVE') ?? null;
  const needsApproval = !!latest && (latest.state === 'DRAFT' || latest.state === 'EXTRACTION_REVIEW') && latest.criteria.length > 0;
  useEffect(() => {
    if (!needsApproval || role !== 'COORDINATOR') return;
    const timer = window.setInterval(protocols.reload, 5000);
    return () => window.clearInterval(timer);
  }, [needsApproval, role, protocols.reload]);
  const attentionCases: ReviewCase[] = [...(reopened.data?.items ?? []), ...(openCases.data?.items ?? [])];

  // Only what the current role can act on.
  const items: AttentionItem[] = [];
  if (protocols.data && !latest && is(role, 'COORDINATOR', 'RESEARCH_IT')) {
    items.push({ tone: 'warn', title: 'No protocol has been uploaded', detail: 'Upload the protocol document to start.', cta: 'Upload protocol', href: `${base}/protocol` });
  }
  if (protocols.data && !latest && role === 'INVESTIGATOR') {
    items.push({ tone: 'info', title: 'Waiting for the Sponsor to upload a protocol', detail: 'You can review the rules after the coordinator uploads the document and runs extraction.', cta: 'View protocol status', href: `${base}/protocol` });
  }
  if (latest?.state === 'DRAFT' && latest.criteria.length === 0 && is(role, 'COORDINATOR', 'INVESTIGATOR')) {
    items.push({ tone: 'info', title: role === 'COORDINATOR' ? 'Next: Extract the protocol rules' : 'Waiting for protocol rule extraction', detail: 'The PDF is uploaded. Run extraction before clinical review can begin.', cta: 'Open protocol', href: `${base}/protocol?version=${encodeURIComponent(latest.protocol_version_id)}` });
  }
  if (latest?.state === 'EXTRACTING' && is(role, 'COORDINATOR', 'INVESTIGATOR')) {
    items.push({ tone: 'info', title: 'Protocol rules are being extracted', detail: 'Wait for extraction to finish before reviewing or approving rules.', cta: 'View extraction progress', href: `${base}/protocol?version=${encodeURIComponent(latest.protocol_version_id)}` });
  }
  if (latest?.state === 'EXTRACTION_FAILED' && is(role, 'COORDINATOR', 'INVESTIGATOR')) {
    items.push({ tone: 'urgent', title: 'The protocol rules could not be read', detail: 'Try again or upload a text-readable document.', cta: 'Open protocol', href: `${base}/protocol` });
  }
  if (needsApproval && latest) {
    if (role === 'INVESTIGATOR') items.push({ tone: 'warn', title: `${latest.criteria.length} protocol rules are waiting for your approval`, detail: 'Check the source citations, resolve blockers and approve coverage. This version cannot screen until approved.', cta: 'Review rules', href: `${base}/protocol?version=${encodeURIComponent(latest.protocol_version_id)}` });
    else if (role === 'COORDINATOR') items.push({ tone: 'info', title: 'Waiting for a Clinical Lead to approve these rules', detail: 'Your next step is to wait for review. Screening stays unavailable for this version until the rules and coverage are approved. Approval status updates automatically.', cta: 'View pending rules', href: `${base}/protocol?version=${encodeURIComponent(latest.protocol_version_id)}` });
  }
  if (attentionCases.length > 0 && is(role, 'INVESTIGATOR', 'MONITOR')) {
    const first = attentionCases[0];
    items.push({
      tone: 'urgent',
      title: `${attentionCases.length} safety case${attentionCases.length === 1 ? ' is' : 's are'} waiting for review`,
      detail: `Patient ${first.patient_id} · ${caseIssue(first.current_summary)}`,
      cta: 'Review case', href: `${base}/cases?case=${encodeURIComponent(first.case_id)}`,
    });
  }
  if (active && trial.data?.patient_count === 0) {
    items.push({ tone: 'info', title: 'No patients to screen', detail: 'The protocol is approved, but this study has no patient records. Choose a study with patients from the Study dropdown above.', cta: 'Choose another study', href: '/' });
  }
  if (active && (trial.data?.patient_count ?? 0) > 0 && role === 'INVESTIGATOR') {
    items.push({ tone: 'info', title: 'Patient screening is available', detail: 'The protocol is approved. Screen patients or review the candidates.', cta: 'Screen patients', href: `${base}/selector` });
  }
  if (active && (trial.data?.patient_count ?? 0) > 0 && role === 'COORDINATOR') {
    items.push({ tone: 'info', title: 'Protocol approved — clinical review continues', detail: 'The Clinical Lead can screen patients and record external participation. Enter new patient records from Safety when available; the system checks relevant events automatically.', cta: 'Open Safety', href: `${base}/monitor` });
  }
  if (is(role, 'AUDITOR', 'SPONSOR_OPS')) {
    items.push({ tone: 'info', title: 'The audit trail is up to date', detail: 'Every protocol, screening and review action is recorded.', cta: 'Open audit trail', href: `${base}/audit` });
  }

  const tile = 'card block p-5 text-ink no-underline hover:bg-canvas';
  return (
    <div>
      <div className="space-y-5">
        <section className="card card-pad space-y-3" aria-labelledby="attention">
          <h2 id="attention">What needs your attention as {ROLE_LABEL[role] === 'Research IT' ? 'research IT' : ROLE_LABEL[role].toLowerCase()}</h2>
          {(protocols.loading || openCases.loading || reopened.loading) && <LoadingSkeleton rows={2} />}
          {protocols.error ? <ErrorPanel error={protocols.error} onRetry={protocols.reload} /> : null}
          {openCases.error ? <ErrorPanel error={openCases.error} onRetry={openCases.reload} /> : null}
          {items.map((item, i) => (
            <div key={item.title} className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${TONE[item.tone]}`}>
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                <p className="text-ink-muted">{item.detail}</p>
              </div>
              <Link className={i === 0 ? 'btn-primary' : 'btn-secondary'} href={item.href}>{item.cta}</Link>
            </div>
          ))}
          {protocols.data && (!readsCases || (openCases.data && reopened.data)) && items.length === 0 && <p className="note">Nothing needs your attention right now.</p>}
        </section>

        {trial.data && (
          <section aria-label="Study summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {hasStep('screen') && (
              <Link href={`${base}/selector`} className={tile}>
                <span className="block text-ink-muted">Patients in the study</span>
                <span className="block text-3xl font-bold tabular-nums">{trial.data.patient_count}</span>
                <span className="block font-semibold text-brand">View candidates</span>
              </Link>
            )}
            {hasStep('protocol') ? (
              <Link href={`${base}/protocol`} className={tile}>
                <span className="block text-ink-muted">Protocol</span>
                <span className="block text-3xl font-bold">{active ? 'Approved' : latest ? 'In review' : 'Not uploaded'}</span>
                <span className="block font-semibold text-brand">View protocol</span>
              </Link>
            ) : (
              <div className="card p-5">
                <span className="block text-ink-muted">Protocol</span>
                <span className="block text-3xl font-bold">{active ? 'Approved' : latest ? 'In review' : 'Not uploaded'}</span>
              </div>
            )}
            {hasStep('safety') && (
              <>
                <Link href={`${base}/monitor`} className={tile}>
                  <span className="block text-ink-muted">Safety findings</span>
                  <span className="block text-3xl font-bold tabular-nums">{trial.data.finding_count}</span>
                  <span className="block font-semibold text-brand">Open safety</span>
                </Link>
                <Link href={`${base}/monitor`} className={tile}>
                  <span className="block text-ink-muted">Open safety cases</span>
                  <span className="block text-3xl font-bold tabular-nums">
                    {openCases.data && reopened.data ? countLabel(openCases.data.page, openCases.data.items.length + reopened.data.items.length) : '–'}
                  </span>
                  <span className="block font-semibold text-brand">Review cases</span>
                </Link>
              </>
            )}
            {hasStep('audit') && (
              <Link href={`${base}/audit`} className={tile}>
                <span className="block text-ink-muted">Audit trail</span>
                <span className="block text-3xl font-bold">Up to date</span>
                <span className="block font-semibold text-brand">Open audit trail</span>
              </Link>
            )}
          </section>
        )}

        {attentionCases.length > 0 && (
          <section className="space-y-3" aria-labelledby="att-list">
            <h2 id="att-list">Cases waiting for review</h2>
            <CaseTable trialId={trialId} cases={attentionCases} />
          </section>
        )}
      </div>
    </div>
  );
}
