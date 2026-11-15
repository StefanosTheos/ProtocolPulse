'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ErrorPanel } from './ErrorBoundary';
import { MAX_PDF_MB, fileProblem, formatBytes, labelProblem } from './ProtocolUpload';
import { invalidateReads } from '@/lib/api/cache';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';

// The demo backend registers one site; new studies are created there.
const DEMO_SITE = { site_id: 'SITE-SYN-01', site_timezone: 'Europe/Athens' };

// Registers a study and uploads its first protocol in one step, so the Sponsor does not have to
// pick an existing study before adding a new protocol.
export function NewStudyForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [product, setProduct] = useState('');
  const [version, setVersion] = useState('1.0');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [declared, setDeclared] = useState(false);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  // A study that was created before its upload failed is reused on retry instead of duplicated.
  const [createdTrialId, setCreatedTrialId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createKey = useIdempotencyKey('create-trial');
  const uploadKey = useIdempotencyKey('upload');
  const busy = progress !== null;

  const problems = {
    file: fileProblem(file),
    title: title.trim() ? null : 'Enter a study name.',
    product: product.trim() ? null : 'Enter the study product, for example PX-104.',
    version: labelProblem(version),
    dates: !start || !end ? 'Choose the planned start and end dates.' : end < start ? 'The planned end must be after the start.' : null,
    declared: declared ? null : 'Confirm the document contains no real patient data.',
  };
  const show = (key: keyof typeof problems) => (touched || (key === 'file' && file) ? problems[key] : null);

  function pick(next: File | null) {
    uploadKey.reset();
    setError(null);
    setFile(next);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) pick(dropped);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (busy || !file || Object.values(problems).some(Boolean)) return;
    setError(null);
    setProgress(0);
    try {
      let trialId = createdTrialId;
      if (!trialId) {
        const created = await getApi().createTrial({
          title: title.trim(), fictional_product_code: product.trim(), ...DEMO_SITE,
          planned_start_date: start, planned_end_date: end, synthetic_only: true,
        }, createKey.current());
        trialId = created.data.trial_id;
        setCreatedTrialId(trialId);
      }
      const uploaded = await getApi().uploadProtocol(trialId, { file, versionLabel: version.trim() }, uploadKey.current(), setProgress);
      invalidateReads();
      router.push(`/trials/${encodeURIComponent(trialId)}/protocol?version=${encodeURIComponent(uploaded.data.protocol_version_id)}`);
    } catch (err) {
      setError(err);
    } finally {
      setProgress(null);
    }
  }

  const fileMsg = show('file');
  const zone = `flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${
    dragging ? 'border-brand bg-brand-soft' : fileMsg ? 'border-fail-line bg-fail-bg' : 'border-line-strong bg-canvas hover:bg-brand-soft'
  }`;
  const field = (key: keyof typeof problems, id: string) => show(key) && <p id={`${id}-msg`} className="mt-1 text-fail-fg">{show(key)}</p>;

  return (
    <form className="card space-y-5 p-6 shadow-lg sm:p-7" onSubmit={submit} aria-labelledby="new-study-heading" noValidate>
      <div>
        <h2 id="new-study-heading" className="text-xl">New study</h2>
        <p className="text-ink-muted">One step: name the study and add its protocol. No need to pick an existing study first.</p>
      </div>

      <div>
        <input id="new-study-file" ref={inputRef} type="file" aria-label="Protocol PDF file" accept="application/pdf,.pdf" className="peer sr-only"
          aria-invalid={Boolean(fileMsg)} aria-describedby={fileMsg ? 'new-study-file-msg' : undefined}
          onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={busy} />
        {file && !problems.file ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pass-line bg-pass-bg px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold" title={file.name}>{file.name}</p>
              <p className="text-xs text-ink-muted">PDF · {formatBytes(file.size)}</p>
            </div>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => { pick(null); if (inputRef.current) inputRef.current.value = ''; }}>Remove</button>
          </div>
        ) : (
          <label htmlFor="new-study-file" className={zone}
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <svg aria-hidden="true" width="36" height="36" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <path d="M24 5H12a3 3 0 0 0-3 3v24a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V12z" /><path d="M24 5v7h7" /><path d="M20 29V18" /><path d="m15.5 22.5 4.5-4.5 4.5 4.5" />
            </svg>
            <span className="text-[15px] font-semibold text-ink">Drag the protocol PDF here, or <span className="text-brand underline">browse</span></span>
            <span className="text-xs text-ink-muted">PDF file, up to {MAX_PDF_MB} MB</span>
          </label>
        )}
        {fileMsg && <p id="new-study-file-msg" className="mt-1 text-fail-fg">{fileMsg}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="study-name">Study name</label>
          <input id="study-name" className="input" value={title} placeholder="e.g. PX-104 study" disabled={busy || Boolean(createdTrialId)}
            aria-invalid={Boolean(show('title'))} onChange={(e) => { createKey.reset(); setTitle(e.target.value); }} />
          {field('title', 'study-name')}
        </div>
        <div>
          <label className="label" htmlFor="study-product">Study product</label>
          <input id="study-product" className="input" value={product} placeholder="e.g. PX-104" disabled={busy || Boolean(createdTrialId)}
            aria-invalid={Boolean(show('product'))} onChange={(e) => { createKey.reset(); setProduct(e.target.value); }} />
          {field('product', 'study-product')}
        </div>
        <div>
          <label className="label" htmlFor="study-version">Protocol version</label>
          <input id="study-version" className="input" value={version} placeholder="e.g. 1.0" disabled={busy}
            aria-invalid={Boolean(show('version'))} onChange={(e) => { uploadKey.reset(); setVersion(e.target.value); }} />
          {field('version', 'study-version')}
        </div>
        <div>
          <label className="label" htmlFor="study-start">Planned start</label>
          <input id="study-start" type="date" className="input" value={start} disabled={busy || Boolean(createdTrialId)}
            aria-invalid={Boolean(show('dates'))} onChange={(e) => { createKey.reset(); setStart(e.target.value); }} />
        </div>
        <div>
          <label className="label" htmlFor="study-end">Planned end</label>
          <input id="study-end" type="date" className="input" value={end} disabled={busy || Boolean(createdTrialId)}
            aria-invalid={Boolean(show('dates'))} onChange={(e) => { createKey.reset(); setEnd(e.target.value); }} />
        </div>
        {show('dates') && <p className="text-fail-fg sm:col-span-2">{show('dates')}</p>}
      </div>

      <div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={declared} disabled={busy} onChange={(e) => setDeclared(e.target.checked)} />
          <span>This document contains no real patient or sponsor data.</span>
        </label>
        {show('declared') && <p className="mt-1 text-fail-fg">{show('declared')}</p>}
      </div>

      {busy && (
        <div className="space-y-1" aria-live="polite">
          <p className="text-xs text-ink-muted">Creating the study and uploading the protocol, {Math.round((progress ?? 0) * 100)}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        </div>
      )}
      {error ? <ErrorPanel error={error} context={createdTrialId ? 'The study was created, but the protocol was not uploaded' : 'The study was not created'} /> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn-primary px-5 py-2.5 text-[15px]" disabled={busy}>{createdTrialId ? 'Upload protocol' : 'Create study and upload protocol'}</button>
        <span className="text-xs text-ink-muted">Next: the rules are read from the PDF.</span>
      </div>
    </form>
  );
}
