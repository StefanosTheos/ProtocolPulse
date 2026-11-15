'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { JobProgress } from '@/components/JobProgress';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ProtocolCoverageReview } from '@/components/ProtocolCoverageReview';
import { ProtocolUpload } from '@/components/ProtocolUpload';
import { ProtocolStatePill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { screeningGate } from '@/lib/api/gates';
import { useApiQuery, useIdempotencyKey, useJobRunner } from '@/lib/api/hooks';
import { sentenceCase } from '@/lib/api/labels';
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

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          {awaitingApproval && (
            <section role="status" className="rounded-lg border border-unknown-line bg-unknown-bg p-4 text-unknown-fg">
              <p className="font-semibold">{actor.role === 'INVESTIGATOR' ? 'Next: Review and approve these rules' : 'Waiting for a Clinical Lead to approve these rules'}</p>
              <p>{actor.role === 'INVESTIGATOR' ? 'Check the source citations, resolve any blockers and sign coverage below. Screening becomes available after approval.' : 'These proposals await clinical review. The reviewer must resolve any blockers and approve the rules before this version can screen patients.'}</p>
              {actor.role === 'COORDINATOR' && <p className="mt-1 text-xs">Approval status updates automatically while you wait.</p>}
            </section>
          )}
          {protocols.loading && !protocols.data && <LoadingSkeleton rows={4} label="Loading protocol" />}
          {protocols.error ? <ErrorPanel error={protocols.error} context="Could not load protocol versions" onRetry={protocols.reload} /> : null}
          {protocols.data && !protocol && <EmptyState title="No protocol uploaded">{actor.role === 'INVESTIGATOR' ? 'Waiting for the Sponsor to upload a protocol and extract its rules.' : 'Next: Upload the protocol document, then run extraction to prepare its rules for clinical review.'}</EmptyState>}

          {protocol && (
            <section className="card card-pad space-y-2" aria-labelledby="version-heading">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="version-heading">Protocol {protocol.label}</h2>
                <ProtocolStatePill state={protocol.state} />
              </div>
              <details className="text-xs">
                <summary className="font-semibold text-ink-muted">Technical details</summary>
                <p className="mt-1 text-ink-muted">
                  <span className="mono">{protocol.protocol_version_id}</span> · revision {protocol.revision} · source <span className="mono">{protocol.source.source_id}</span> v{protocol.source.source_version} · {protocol.source.filename} ·
                  SHA-256 <span className="mono break-all">{protocol.file_sha256}</span>
                </p>
              </details>
              {items.length > 1 && (
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-ink-muted">Version</span>
                  <select className="input w-auto py-1" value={protocol.protocol_version_id} onChange={(e) => { setOverride(null); setReviewNotice(null); router.replace(`${base}/protocol?version=${encodeURIComponent(e.target.value)}`); }}>
                    {items.map((p) => <option key={p.protocol_version_id} value={p.protocol_version_id}>{p.label} · {sentenceCase(p.state)}</option>)}
                  </select>
                </label>
              )}
              {(protocol.state === 'DRAFT' || protocol.state === 'EXTRACTION_REVIEW') && protocol.criteria.length > 0 && protocol.extraction_job_id === null && (
                <p className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">
                  No extraction job is recorded for this proposal. Treat it as a curated proposal: it does not show that a model ran, and it is unsigned until the Clinical Lead approves it.
                </p>
              )}
            </section>
          )}

          {protocol && (protocol.state === 'DRAFT' || protocol.state === 'EXTRACTION_FAILED' || protocol.state === 'EXTRACTING') && (
            <section className="card card-pad space-y-3" aria-labelledby="extract-heading">
              <h2 id="extract-heading">Read rules from the protocol</h2>
              {protocol.state === 'DRAFT' && protocol.criteria.length === 0 && <p className="text-ink-muted">Extraction has not run. No rules or coverage exist yet, so there is nothing to review.</p>}
              {protocol.state === 'DRAFT' && protocol.criteria.length > 0 && (
                <p className="text-ink-muted">A proposal is registered without an extraction run. Review it below, or run extraction to re-validate it against the stored source.</p>
              )}
              {protocol.state === 'EXTRACTION_FAILED' && (
                <p className="text-fail-fg">Extraction failed for this source. No proposal was substituted. Retry, or upload a repaired, text-readable PDF as a new version.</p>
              )}
              {protocol.state === 'EXTRACTING' && <p className="text-ink-muted">Extraction is running on the backend.</p>}
              <JobProgress job={extractJob.job} error={extractJob.error} running={extractJob.running} label="Extraction job" />
              {extractError ? <ErrorPanel error={extractError} context="Could not start extraction" /> : null}
              {protocol.state !== 'EXTRACTING' && (
                <button type="button" className="btn-primary" disabled={!canExtract || extractJob.running} onClick={() => startExtraction(protocol.state === 'EXTRACTION_FAILED')}>
                  {protocol.state === 'EXTRACTION_FAILED' ? 'Retry extraction' : 'Run extraction'}
                </button>
              )}
              {!canExtract && <p className="text-xs text-unknown-fg">Sponsor or Clinical Lead role required to start extraction.</p>}
            </section>
          )}

          {protocol && protocol.criteria.length > 0 && (
            <ProtocolCoverageReview key={`${protocol.protocol_version_id}-${protocol.revision}`} trialId={trialId} protocol={protocol} initialNotice={reviewNotice} onNotice={setReviewNotice} onChanged={(p) => { setOverride(p); protocols.reload(); trial.reload(); }} />
          )}
        </div>

        <aside className="space-y-5">
          <section className="card card-pad" aria-labelledby="screen-gate">
            <h2 id="screen-gate">Screening readiness</h2>
            {gate.allowed ? (
              <>
                <p className="mt-1 text-pass-fg">✓ All rules are approved by the Clinical Lead. Screening is available.</p>
                {actor.role === 'INVESTIGATOR'
                  ? <Link href={`${base}/selector`} className="btn-primary mt-3">Next: Screen patients</Link>
                  : <p className="mt-3 text-ink-muted">Next: The Clinical Lead screens patients and records any externally confirmed participation. You can enter new records from Safety for ongoing review.</p>}
              </>
            ) : (
              <>
                <p className="mt-1 text-ink-muted">Screening is not available yet:</p>
                <ul className="mt-1 list-disc pl-5 text-unknown-fg">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                <button type="button" className="btn-primary mt-3" disabled>Start screening</button>
              </>
            )}
          </section>
          {(actor.role === 'COORDINATOR' || actor.role === 'RESEARCH_IT') && <ProtocolUpload trialId={trialId} onUploaded={(p) => { setOverride(p); protocols.reload(); router.replace(`${base}/protocol?version=${encodeURIComponent(p.protocol_version_id)}`); }} />}
        </aside>
      </div>
    </div>
  );
}

export default function ProtocolPage() {
  return <Suspense fallback={<LoadingSkeleton rows={4} />}><ProtocolPageInner /></Suspense>;
}
