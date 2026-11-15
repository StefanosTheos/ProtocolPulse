'use client';

import { useRef, useState } from 'react';
import { useActor } from './ActorContext';
import { ErrorPanel } from './ErrorBoundary';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { ProtocolDetail } from '@/lib/api/types';

// Client-side pre-checks mirror the contract (PDF, MAX_PDF_MB default 12); the server re-validates.
export const MAX_PDF_MB = 12;

export function validateUpload(file: File | null, versionLabel: string): string[] {
  const problems: string[] = [];
  if (!file) problems.push('Choose a PDF file.');
  else {
    const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!looksPdf) problems.push('Only PDF files are accepted.');
    if (file.size === 0) problems.push('The file is empty.');
    if (file.size > MAX_PDF_MB * 1024 * 1024) problems.push(`The file exceeds ${MAX_PDF_MB} MB.`);
  }
  if (!versionLabel.trim()) problems.push('Enter a version label.');
  return problems;
}

export function ProtocolUpload({ trialId, onUploaded }: { trialId: string; onUploaded: (p: ProtocolDetail) => void }) {
  const { actor } = useActor();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [declared, setDeclared] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idem = useIdempotencyKey('upload');
  const allowed = actor.role === 'COORDINATOR' || actor.role === 'RESEARCH_IT';
  const problems = validateUpload(file, label);
  if (!declared) problems.push('Confirm the document contains no real patient data.');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problems.length || !file) return;
    setError(null);
    setProgress(0);
    try {
      const res = await getApi().uploadProtocol(trialId, { file, versionLabel: label.trim() }, idem.current(), setProgress);
      idem.reset();
      setFile(null);
      setLabel('');
      setDeclared(false);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setProgress(null);
    }
  }

  return (
    <form className="card card-pad space-y-3" onSubmit={submit} aria-labelledby="upload-heading" noValidate>
      <div>
        <h2 id="upload-heading">Upload protocol PDF</h2>
        <p className="text-xs text-ink-muted">Registers an immutable source version. Extraction is a separate, explicit step.</p>
      </div>
      {!allowed && <p className="text-unknown-fg">Switch to Sponsor to upload.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pdf-file">PDF file (max {MAX_PDF_MB} MB)</label>
          <input
            id="pdf-file" ref={inputRef} type="file" accept="application/pdf,.pdf" className="input"
            onChange={(e) => { idem.reset(); setFile(e.target.files?.[0] ?? null); }} disabled={!allowed}
          />
        </div>
        <div>
          <label className="label" htmlFor="version-label">Version label</label>
          <input id="version-label" className="input" value={label} onChange={(e) => { idem.reset(); setLabel(e.target.value); }} placeholder="e.g. 1.1" disabled={!allowed} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={declared} onChange={(e) => setDeclared(e.target.checked)} disabled={!allowed} />
        <span>This document contains no real patient or sponsor data.</span>
      </label>
      {touched && problems.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-fail-fg">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {progress !== null && (
        <div className="space-y-1" aria-live="polite">
          <div className="text-xs text-ink-muted">Uploading… {Math.round(progress * 100)}%</div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
      {error ? <ErrorPanel error={error} context="Upload failed" /> : null}
      <button type="submit" className="btn-primary" disabled={!allowed || progress !== null}>Upload PDF</button>
    </form>
  );
}
