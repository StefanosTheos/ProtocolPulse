'use client';

import { useState } from 'react';
import { ProtocolCitation, SourceViewer } from './ProtocolCitation';
import { CriterionStatusPill, EvidenceStatePill, Pill } from './StatusPill';
import { formatThreshold, formatWindow } from '@/lib/api/gates';
import { REASON_LABEL, criterionName, plainText, sentenceCase } from '@/lib/api/labels';
import { formatFactValue, type LabelledFact } from '@/lib/api/patient';
import { formatInstant } from '@/lib/api/time';
import type { Criterion, CriterionResult, EvidenceRef } from '@/lib/api/types';

function EvidenceRefRow({ trialId, evidence, facts, timeZone }: { trialId: string; evidence: EvidenceRef; facts: LabelledFact[]; timeZone?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="neutral">{sentenceCase(evidence.evidence_type)}</Pill>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-ink-muted">Clinical date</dt><dd>{formatInstant(evidence.effective_at, timeZone)}</dd>
        <dt className="text-ink-muted">Recorded</dt><dd>{formatInstant(evidence.recorded_at, timeZone)}</dd>
        {evidence.page !== null && <><dt className="text-ink-muted">Page</dt><dd>{evidence.page}</dd></>}
      </dl>
      {facts.map((lf) => (
        <div key={lf.fact.fact_id} className="mt-2 rounded bg-canvas p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{lf.label}</span>
            <span>{formatFactValue(lf.fact)}</span>
            <EvidenceStatePill state={lf.fact.evidence_state} />
            <Pill tone={lf.fact.verification_status === 'VERIFIED' ? 'neutral' : 'unknown'}>{sentenceCase(lf.fact.verification_status)}</Pill>
            <Pill tone="neutral">{sentenceCase(lf.fact.evidence_quality)} quality</Pill>
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
    <section className="card card-pad space-y-4" aria-label={`Evidence for ${criterionName(criterion, result.criterion_id)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base">Evidence: {criterionName(criterion, result.criterion_id)}</h3>
        <CriterionStatusPill status={result.status} />
        {result.reason_codes.map((r) => <Pill key={r} tone="unknown">{REASON_LABEL[r] ?? sentenceCase(r)}</Pill>)}
      </div>
      <p>{plainText(result.explanation)}</p>
      <p className="text-xs text-ink-muted">Checked {formatInstant(result.evaluated_at, timeZone)} against the approved protocol rule.</p>
      {criterion ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Protocol clause</h4>
          <p className="text-xs">{plainText(formatThreshold(criterion))} · {formatWindow(criterion.window)}</p>
          <ProtocolCitation trialId={trialId} sourceId={criterion.source_id} page={criterion.source_page} start={criterion.source_anchor.start} end={criterion.source_anchor.end} quote={criterion.source_quote} />
        </div>
      ) : (
        <p className="text-xs text-unknown-fg">The approved rule text could not be loaded.</p>
      )}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Source records ({result.evidence_refs.length})</h4>
        {result.evidence_refs.length === 0
          ? <p className="text-xs text-ink-muted">No source records were found for this criterion.{result.status === 'UNKNOWN' ? ' The criterion is unclear, not met.' : ''}</p>
          : <ul className="space-y-2">{result.evidence_refs.map((e) => <EvidenceRefRow key={e.evidence_id} trialId={trialId} evidence={e} facts={factsByEvidence.get(e.evidence_id) ?? []} timeZone={timeZone} />)}</ul>}
      </div>
    </section>
  );
}
