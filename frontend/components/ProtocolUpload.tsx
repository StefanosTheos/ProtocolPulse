'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useActor } from './ActorContext';
import { ErrorPanel } from './ErrorBoundary';
import { ApiError } from '@/lib/api/client';
import { notifyTrialChanged } from '@/lib/api/events';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { ProtocolDetail } from '@/lib/api/types';

// The backend accepts protocol PDFs up to MAX_PDF_MB; these checks give early, clear feedback and
// the server still re-validates every upload.
export const MAX_PDF_MB = 12;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : 'unknown';
}

export function fileProblem(file: File | null): string | null {
  if (!file) return 'Choose a PDF file.';
  const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksPdf) return `Only PDF files can be uploaded. "${file.name}" is a ${extension(file.name)} file.`;
  if (file.size === 0) return `"${file.name}" is empty. Choose a file with content.`;
  if (file.size > MAX_PDF_MB * 1024 * 1024) return `"${file.name}" is ${formatBytes(file.size)}, larger than ${MAX_PDF_MB} MB. Choose a smaller file.`;
  return null;
}

export function labelProblem(versionLabel: string): string | null {
  return versionLabel.trim() ? null : 'Enter a version label, for example 1.1.';
}

export function validateUpload(file: File | null, versionLabel: string): string[] {
  return [fileProblem(file), labelProblem(versionLabel)].filter((p): p is string => p !== null);
}

const DECLARATION_PROBLEM = 'Confirm the document contains no real patient data.';

export function ProtocolUpload({ trialId, onUploaded }: { trialId: string; onUploaded: (p: ProtocolDetail) => void }) {
  const { actor } = useActor();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [declared, setDeclared] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState<{ label: string; name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idem = useIdempotencyKey('upload');
  const allowed = actor.role === 'COORDINATOR' || actor.role === 'RESEARCH_IT';
  const uploading = progress !== null;

  const duplicateLabel = error instanceof ApiError && error.details.some((d) => d.field === 'version_label' && d.reason === 'duplicate');
  const fileMsg = touched ? fileProblem(file) : file ? fileProblem(file) : null;
  const labelMsg = touched ? labelProblem(label) : null;
  const declMsg = touched && !declared ? DECLARATION_PROBLEM : null;

  function pick(next: File | null) {
    idem.reset();
    setError(null);
    setDone(null);
    setFile(next);
  }

  function clearFile() {
    pick(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (!allowed || uploading) return;
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) pick(dropped);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (uploading || !file || fileProblem(file) || labelProblem(label) || !declared) return;
    setError(null);
    setDone(null);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await getApi().uploadProtocol(trialId, { file, versionLabel: label.trim() }, idem.current(), setProgress, controller.signal);
      idem.reset();
      setDone({ label: res.data.label, name: file.name, size: file.size });
      setFile(null);
      setLabel('');
      setDeclared(false);
      setTouched(false);
      if (inputRef.current) inputRef.current.value = '';
      notifyTrialChanged();
      onUploaded(res.data);
    } catch (err) {
      setError(err);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  const zone = `flex cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
    !allowed ? 'cursor-not-allowed border-line bg-canvas opacity-60' : dragging ? 'border-brand bg-brand-soft' : fileMsg ? 'border-fail-line bg-fail-bg' : 'border-line-strong bg-surface hover:bg-canvas'
  }`;

  return (
    <form className="card card-pad space-y-4" onSubmit={submit} aria-labelledby="upload-heading" noValidate>
      <div>
        <h2 id="upload-heading">Upload a new protocol version</h2>
        <p className="text-ink-muted">PDF only, up to {MAX_PDF_MB} MB. After uploading, read the rules from it and send them to the investigator for approval.</p>
      </div>
      {!allowed && <p className="note">Uploading is done by a coordinator or research IT. Switch role in &quot;Viewing as&quot; to upload.</p>}

      {done && (
        <div role="status" className="done-banner">
          <p className="font-semibold text-pass-fg">✓ Uploaded version {done.label} ({done.name}, {formatBytes(done.size)}).</p>
          <a href="#extract-heading" className="btn-primary">Next: Read the rules</a>
        </div>
      )}

      <div>
        <span className="label required">Protocol file</span>
        <input
          id="pdf-file" ref={inputRef} type="file" aria-label="Protocol PDF file" accept="application/pdf,.pdf" className="peer sr-only"
          aria-invalid={Boolean(fileMsg)} aria-describedby={fileMsg ? 'pdf-file-msg' : undefined}
          onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={!allowed || uploading}
        />
        {file && !fileProblem(file) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold" title={file.name}>{file.name}</p>
              <p className="text-xs text-ink-muted">PDF · {formatBytes(file.size)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>Choose another</button>
              <button type="button" className="btn-ghost" disabled={uploading} onClick={clearFile}>Remove</button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="pdf-file" className={zone}
            onDragOver={(e) => { e.preventDefault(); if (allowed && !uploading) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="font-semibold text-ink">Drag a PDF here, or <span className="text-brand underline">browse</span></span>
            <span className="text-xs text-ink-muted">PDF file (max {MAX_PDF_MB} MB)</span>
          </label>
        )}
        {fileMsg && <p id="pdf-file-msg" className="mt-1 text-fail-fg">{fileMsg}</p>}
      </div>

      <div className="max-w-xs">
        <label className="label required" htmlFor="version-label">Version label</label>
        <input
          id="version-label" className="input" value={label} placeholder="e.g. 1.1" required disabled={!allowed || uploading}
          aria-invalid={Boolean(labelMsg || duplicateLabel)} aria-describedby={labelMsg || duplicateLabel ? 'version-label-msg' : undefined}
          onChange={(e) => { idem.reset(); setError(null); setDone(null); setLabel(e.target.value); }}
        />
        {(labelMsg || duplicateLabel) && <p id="version-label-msg" className="mt-1 text-fail-fg">{labelMsg ?? `Version ${label.trim()} already exists. Use a new label, for example ${label.trim()}.1.`}</p>}
      </div>

      <div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={declared} required disabled={!allowed || uploading}
            aria-invalid={Boolean(declMsg)} aria-describedby={declMsg ? 'declare-msg' : undefined}
            onChange={(e) => setDeclared(e.target.checked)} />
          <span className="required">This document contains no real patient or sponsor data.</span>
        </label>
        {declMsg && <p id="declare-msg" className="mt-1 text-fail-fg">{declMsg}</p>}
      </div>

      {uploading && (
        <div className="space-y-1" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
            <span>Uploading… {Math.round((progress ?? 0) * 100)}%</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => abortRef.current?.abort()}>Cancel upload</button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-line" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand transition-[width]" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        </div>
      )}
      {error ? <ErrorPanel error={error} context="Upload not completed" /> : null}
      <p className="text-xs text-ink-muted"><span aria-hidden="true" className="text-fail-fg">*</span> Required field</p>
      <button type="submit" className="btn-primary" disabled={!allowed || uploading}>{uploading ? 'Uploading…' : 'Upload PDF'}</button>
    </form>
  );
}
