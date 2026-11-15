'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { ExtractionProgress } from '@/components/JobProgress';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ProtocolCoverageReview } from '@/components/ProtocolCoverageReview';
import { ProtocolUpload } from '@/components/ProtocolUpload';
import { ProtocolStatePill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { screeningGate } from '@/lib/api/gates';
import { useApiQuery, useIdempotencyKey, useJobRunner } from '@/lib/api/hooks';
import { PROTOCOL_STATE_LABEL } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { ProtocolDetail } from '@/lib/api/types';

function ProtocolPageInner() {
  const { trialId } = useParams<{ trialId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const protocols = useApiQuery(() => getApi().listProtocols(trialId, { sort: '-created_at', limit: 50 }).then((r) => r.data), [trialId, actor.actor_id]);
  const [override, setOverride] = useState<ProtocolDetail | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const extractJob = useJobRunner({ intervalMs: 1000, timeoutMs: 120_000 });
  const extractKey = useIdempotencyKey('extract');
  const [extractError, setExtractError] = useState<unknown>(null);

  const items = protocols.data?.items ?? [];
  const requested = search?.get('version');
  const fromList = items.find((p) => p.protocol_version_id === requested)
    ?? items.find((p) => p.state === 'ACTIVE') ?? items[0] ?? null;
  const protocol = override && override.protocol_version_id === fromList?.protocol_version_id && override.revision > fromList.revision ? override : fromList;
  const base = `/trials/${encodeURIComponent(trialId)}`;

  async function refreshProtocol(versionId: string) {
    const res = await getApi().getProtocol(trialId, versionId);
    setOverride(res.data);
    protocols.reload();
    trial.reload();
  }

  // Resume polling if the backend reports an in-flight extraction.
  const inflightJob = protocol?.state === 'EXTRACTING' ? protocol.extraction_job_id : null;
  useEffect(() => {
    if (!inflightJob || !protocol) return;
    const versionId = protocol.protocol_version_id;
    extractJob.run(inflightJob).then((job) => { if (job) void refreshProtocol(versionId); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inflightJob]);

  async function startExtraction(force: boolean) {
    if (!protocol) return;
    setExtractError(null);
    try {
      const res = await getApi().extractProtocol(trialId, protocol.protocol_version_id, force, extractKey.current());
      extractKey.reset();
      const job = await extractJob.run(res.data.job_id);
      if (job) await refreshProtocol(protocol.protocol_version_id);
    } catch (e) {
      setExtractError(e);
    }
  }

  const gate = screeningGate(trial.data, protocol);
  const canExtract = actor.role === 'COORDINATOR' || actor.role === 'INVESTIGATOR';
  const awaitingApproval = !!protocol && (protocol.state === 'DRAFT' || protocol.state === 'EXTRACTION_REVIEW') && protocol.criteria.length > 0;

  useEffect(() => {
    if (!awaitingApproval || actor.role !== 'COORDINATOR') return;
    const timer = window.setInterval(protocols.reload, 5000);
    return () => window.clearInterval(timer);
  }, [awaitingApproval, actor.role, protocols.reload]);

  const canUpload = actor.role === 'COORDINATOR' || actor.role === 'RESEARCH_IT';
  const reading = protocol?.state === 'EXTRACTING' || extractJob.running;

  return (
    <div className="space-y-5">
      {awaitingApproval && (
        <section role="status" className="rounded-lg border border-unknown-line bg-unknown-bg p-4 text-unknown-fg">
          <p className="font-semibold">{actor.role === 'INVESTIGATOR' ? 'Next: Review and approve these rules' : 'Waiting for a Clinical Lead to approve these rules'}</p>
          <p>{actor.role === 'INVESTIGATOR' ? 'Check the source citations, resolve any blockers and sign coverage below. Screening becomes available after approval.' : 'These proposals await clinical review. The reviewer must resolve any blockers and approve the rules before this version can screen patients.'}</p>
          {actor.role === 'COORDINATOR' && <p className="mt-1 text-xs">Approval status updates automatically while you wait.</p>}
        </section>
      )}

      {/* Readiness and upload sit above the rules so the rules table can use the full page width. */}
      <div className={`grid items-start gap-5 ${canUpload ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : ''}`}>
        <section className="card card-pad" aria-labelledby="screen-gate">
          <h2 id="screen-gate">Screening readiness</h2>
          {gate.allowed ? (
            <>
              <p className="mt-1 font-semibold text-pass-fg">✓ All rules are approved by the Clinical Lead. Screening is available.</p>
              {actor.role === 'INVESTIGATOR'
                ? <Link href={`${base}/selector`} className="btn-primary mt-3">Next: Screen patients</Link>
                : <p className="mt-2 text-ink-muted">Next: The Clinical Lead screens patients and records any externally confirmed participation. You can enter new records from Safety for ongoing review.</p>}
            </>
          ) : (
            <>
              <p className="mt-1 font-semibold text-unknown-fg">Not available yet</p>
              <ul className="mt-1 list-disc pl-5 text-ink-muted">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <button type="button" className="btn-primary mt-3" disabled>Start screening</button>
            </>
          )}
        </section>
        {canUpload && <ProtocolUpload trialId={trialId} onUploaded={(p) => { setOverride(p); protocols.reload(); router.replace(`${base}/protocol?version=${encodeURIComponent(p.protocol_version_id)}`); }} />}
      </div>

      {protocols.loading && !protocols.data && <LoadingSkeleton rows={4} label="Loading protocol" />}
      {protocols.error ? <ErrorPanel error={protocols.error} context="Could not load protocol versions" onRetry={protocols.reload} /> : null}
      {protocols.data && !protocol && <EmptyState title="No protocol uploaded">{actor.role === 'INVESTIGATOR' ? 'Waiting for the Sponsor to upload a protocol and extract its rules.' : 'Next: Upload the protocol document, then run extraction to prepare its rules for clinical review.'}</EmptyState>}

      {protocol && (
        <section className="card card-pad space-y-4" aria-labelledby="version-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="version-heading">Protocol {protocol.label}</h2>
              <ProtocolStatePill state={protocol.state} />
            </div>
            {items.length > 1 && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">Version</span>
                <select className="input w-auto py-1" value={protocol.protocol_version_id} onChange={(e) => { setOverride(null); setReviewNotice(null); router.replace(`${base}/protocol?version=${encodeURIComponent(e.target.value)}`); }}>
                  {items.map((p) => <option key={p.protocol_version_id} value={p.protocol_version_id}>{p.label} · {PROTOCOL_STATE_LABEL[p.state]}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="text-xs text-ink-muted">{protocol.source.filename}{actor.role === 'INVESTIGATOR' ? <> · File and version identifiers are kept in the <Link href={`${base}/audit`} className="font-semibold text-brand underline-offset-2 hover:underline">audit trail</Link>.</> : null}</p>
          {(protocol.state === 'DRAFT' || protocol.state === 'EXTRACTION_REVIEW') && protocol.criteria.length > 0 && protocol.extraction_job_id === null && (
            <p className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">
              These rules were prepared by hand, not read automatically from the document. They are not in use until the Clinical Lead approves them.
            </p>
          )}

          {(protocol.state === 'DRAFT' || protocol.state === 'EXTRACTION_FAILED' || protocol.state === 'EXTRACTING') && (
            <div className="space-y-3 border-t border-line pt-4" aria-labelledby="extract-heading">
              <h3 id="extract-heading" className="text-base">Read rules from the protocol</h3>
              {!reading && protocol.state === 'DRAFT' && protocol.criteria.length === 0 && <p className="text-ink-muted">The rules have not been read yet, so there is nothing to review.</p>}
              {!reading && protocol.state === 'DRAFT' && protocol.criteria.length > 0 && (
                <p className="text-ink-muted">Review the prepared rules below, or read the rules from the document to check them against it.</p>
              )}
              {!reading && protocol.state === 'EXTRACTION_FAILED' && (
                <p className="text-fail-fg">The rules could not be read from this document. Try again, or upload a text-readable PDF as a new version.</p>
              )}
              <ExtractionProgress job={extractJob.job} error={extractJob.error} running={reading} />
              {extractError ? <ErrorPanel error={extractError} context="Could not start reading the rules" /> : null}
              {!reading && (
                <button type="button" className="btn-primary" disabled={!canExtract} onClick={() => startExtraction(protocol.state === 'EXTRACTION_FAILED')}>
                  {protocol.state === 'EXTRACTION_FAILED' ? 'Try again' : 'Read rules from protocol'}
                </button>
              )}
              {!canExtract && <p className="text-xs text-unknown-fg">Sponsor or Clinical Lead role required to read the rules.</p>}
            </div>
          )}
        </section>
      )}

      {protocol && reading && protocol.criteria.length === 0 && (
        <section className="card" aria-label="Extracted rules, loading">
          <div className="border-b border-line px-5 py-4">
            <h2>Extracted rules</h2>
            <p className="text-xs text-ink-muted">Rules appear here as soon as reading finishes. They stay proposals until the Clinical Lead approves them.</p>
          </div>
          <div className="animate-pulse px-5 pb-4 pt-2 motion-reduce:animate-none" aria-hidden="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-[2fr_3fr_2fr_2fr_1fr] gap-5 border-b border-line py-4 last:border-b-0">
                <span className="h-3 rounded-md bg-brand-soft" /><span className="h-3 rounded-md bg-neutral-bg" /><span className="h-3 rounded-md bg-neutral-bg" /><span className="h-3 rounded-md bg-neutral-bg" /><span className="h-3 rounded-md bg-brand-soft" />
              </div>
            ))}
          </div>
        </section>
      )}

      {protocol && protocol.criteria.length > 0 && (
        <ProtocolCoverageReview key={`${protocol.protocol_version_id}-${protocol.revision}`} trialId={trialId} protocol={protocol} initialNotice={reviewNotice} onNotice={setReviewNotice} onChanged={(p) => { setOverride(p); protocols.reload(); trial.reload(); }} />
      )}
    </div>
  );
}

export default function ProtocolPage() {
  return <Suspense fallback={<LoadingSkeleton rows={4} />}><ProtocolPageInner /></Suspense>;
}
