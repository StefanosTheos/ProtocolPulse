'use client';

import { useState } from 'react';
import { ProtocolCitation, SourceViewer } from './ProtocolCitation';
import { CriterionStatusPill, EvidenceStatePill, Pill } from './StatusPill';
import { formatThreshold, formatWindow } from '@/lib/api/gates';
import { formatFactValue, type LabelledFact } from '@/lib/api/patient';
import { formatInstant } from '@/lib/api/time';
import type { Criterion, CriterionResult, EvidenceRef } from '@/lib/api/types';

function EvidenceRefRow({ trialId, evidence, facts, timeZone }: { trialId: string; evidence: EvidenceRef; facts: LabelledFact[]; timeZone?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono font-semibold">{evidence.evidence_id}</span>
        <Pill tone="neutral">{evidence.evidence_type}</Pill>
        <span className="mono text-ink-muted">{evidence.source_id} v{evidence.source_version}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-ink-muted">Effective (clinical)</dt><dd>{formatInstant(evidence.effective_at, timeZone)}</dd>
        <dt className="text-ink-muted">Recorded</dt><dd>{formatInstant(evidence.recorded_at, timeZone)}</dd>
        {evidence.page !== null && <><dt className="text-ink-muted">Page</dt><dd>{evidence.page}</dd></>}
        {evidence.span_start !== null && <><dt className="text-ink-muted">Span</dt><dd className="mono">[{evidence.span_start}, {evidence.span_end})</dd></>}
      </dl>
      {facts.map((lf) => (
        <div key={lf.fact.fact_id} className="mt-2 rounded bg-canvas p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{lf.label}</span>
            <span>{formatFactValue(lf.fact)}</span>
            <EvidenceStatePill state={lf.fact.evidence_state} />
            <Pill tone={lf.fact.verification_status === 'VERIFIED' ? 'neutral' : 'unknown'}>{lf.fact.verification_status}</Pill>
            <Pill tone="neutral">Quality {lf.fact.evidence_quality}</Pill>
          </div>
          {lf.fact.time_uncertainty && (
            <p className="mt-1 text-unknown-fg">
              Date uncertainty: recorded as &quot;{lf.fact.time_uncertainty.raw_date}&quot; ({lf.fact.time_uncertainty.precision.toLowerCase()} precision)
              {lf.fact.time_uncertainty.possible_interval && <> · possible {formatInstant(lf.fact.time_uncertainty.possible_interval.earliest, timeZone)} → {formatInstant(lf.fact.time_uncertainty.possible_interval.latest_exclusive, timeZone)} (excl.)</>}
            </p>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost mt-2 px-1.5 py-0.5 text-xs" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide source record' : 'Open source record'}
      </button>
      {open && (
        <div className="mt-2">
          <SourceViewer trialId={trialId} sourceId={evidence.source_id} version={evidence.source_version} page={evidence.page} start={evidence.span_start} end={evidence.span_end} />
        </div>
      )}
    </li>
  );
}

export function EvidencePanel({ trialId, result, criterion, factsByEvidence, timeZone }: {
  trialId: string; result: CriterionResult; criterion: Criterion | undefined; factsByEvidence: Map<string, LabelledFact[]>; timeZone?: string;
}) {
  return (
    <section className="card card-pad space-y-4" aria-label={`Evidence for ${result.criterion_id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3>Evidence · <span className="mono">{result.criterion_id}</span></h3>
        <CriterionStatusPill status={result.status} />
        {result.reason_codes.map((r) => <Pill key={r} tone="unknown">{r}</Pill>)}
      </div>
      <p>{result.explanation}</p>
      <p className="text-xs text-ink-muted">Evaluated {formatInstant(result.evaluated_at, timeZone)} by the deterministic backend engine.</p>
      {criterion ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Protocol clause</h4>
          <p className="text-xs"><span className="mono">{criterion.operator}</span> · {formatThreshold(criterion)} · {formatWindow(criterion.window)}</p>
          <ProtocolCitation trialId={trialId} sourceId={criterion.source_id} page={criterion.source_page} start={criterion.source_anchor.start} end={criterion.source_anchor.end} quote={criterion.source_quote} />
        </div>
      ) : (
        <p className="text-xs text-unknown-fg">The approved rule text for {result.criterion_id} could not be loaded.</p>
      )}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Source records ({result.evidence_refs.length})</h4>
        {result.evidence_refs.length === 0
          ? <p className="text-xs text-ink-muted">No evidence references returned for this result.{result.status === 'UNKNOWN' ? ' The rule is unknown, not passed.' : ''}</p>
          : <ul className="space-y-2">{result.evidence_refs.map((e) => <EvidenceRefRow key={e.evidence_id} trialId={trialId} evidence={e} facts={factsByEvidence.get(e.evidence_id) ?? []} timeZone={timeZone} />)}</ul>}
      </div>
    </section>
  );
}
