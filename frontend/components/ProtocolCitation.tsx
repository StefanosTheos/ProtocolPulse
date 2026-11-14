'use client';

import { useState } from 'react';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import { splitAtCodePointSpan } from '@/lib/api/text';

// Fetches a source through the authorised evidence endpoint and highlights a code-point span.
export function SourceViewer({ trialId, sourceId, version, page, start, end }: {
  trialId: string; sourceId: string; version?: number; page: number | null; start: number | null; end: number | null;
}) {
  const source = useApiQuery(
    () => getApi().getEvidenceSource(trialId, sourceId, { version, page: page ?? undefined }).then((r) => r.data),
    [trialId, sourceId, version, page],
  );
  if (source.loading) return <LoadingSkeleton rows={3} label="Loading source" />;
  if (source.error) return <ErrorPanel error={source.error} context="Source unavailable" onRetry={source.reload} />;
  if (!source.data) return null;
  const spans = source.data.spans.filter((s) => page === null || s.page === null || s.page === page);
  if (!spans.length) return <p className="text-ink-muted">The API returned no text for this reference.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">
        <span className="mono">{source.data.source_id}</span> v{source.data.source_version} · {source.data.filename} · {source.data.kind}
        {source.data.page_count !== null && <> · {source.data.page_count} pages</>}
      </p>
      {spans.map((s, i) => {
        let parts: [string, string, string] = [s.text, '', ''];
        if (start !== null && end !== null) {
          // Contract offsets are relative to the persisted page/note text; this span starts at s.start.
          try { parts = splitAtCodePointSpan(s.text, start - s.start, end - s.start); } catch { /* span outside returned text */ }
        }
        return (
          <pre key={i} className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-line bg-canvas p-3 font-mono text-xs leading-relaxed">
            {parts[0]}{parts[1] && <mark className="rounded-sm bg-unknown-bg px-0.5 text-ink">{parts[1]}</mark>}{parts[2]}
          </pre>
        );
      })}
    </div>
  );
}

export function ProtocolCitation({ trialId, sourceId, page, start, end, quote, label }: {
  trialId: string; sourceId: string; page: number; start: number; end: number; quote: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <figure className="space-y-1.5">
      <blockquote className="whitespace-pre-line border-l-2 border-brand pl-3 text-ink">{quote.trim()}</blockquote>
      <figcaption className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {label && <span className="font-medium text-ink">{label}</span>}
        <span>Page {page}</span>
        <span className="mono" title="Zero-based, end-exclusive Unicode code-point offsets in the extracted page text">[{start}, {end})</span>
        <span className="mono">{sourceId}</span>
        <button type="button" className="btn-ghost px-1.5 py-0.5 text-xs" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide source page' : 'Show in source page'}
        </button>
      </figcaption>
      {open && <SourceViewer trialId={trialId} sourceId={sourceId} page={page} start={start} end={end} />}
    </figure>
  );
}
