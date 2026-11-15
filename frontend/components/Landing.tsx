'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActor } from './ActorContext';
import { EmptyState, ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { NewStudyForm } from './NewStudyForm';
import { Pill } from './StatusPill';
import { listAllTrials } from './StudySelector';
import { useApiQuery } from '@/lib/api/hooks';
import { displayTitle, formatDay } from '@/lib/api/labels';
import type { Trial } from '@/lib/api/types';

const COPY = {
  COORDINATOR: {
    eyebrow: 'Sponsor workspace',
    title: 'Start a study from its protocol',
    intro: 'Upload the protocol PDF to register a new study, or open one that is already running. The rules are read from the document and sent to the Clinical Lead for approval.',
    listTitle: 'Ongoing studies',
    empty: 'Create your first study with the form on this page.',
    stepsTitle: 'What happens after you upload',
    steps: [
      ['Rules are read from the protocol', 'Eligibility and safety rules are found, each linked to its page in the document.'],
      ['The Clinical Lead approves them', 'Nothing is used for screening until every rule is approved.'],
      ['You add new clinical records', 'Each record is checked against the protocol. Findings go to the Clinical Lead.'],
    ],
  },
  INVESTIGATOR: {
    eyebrow: 'Clinical Lead workspace',
    title: 'Review, screen and keep patients safe',
    intro: 'Choose a study to approve its protocol rules, screen patients against them and review safety cases.',
    listTitle: 'Your studies',
    empty: 'New studies appear here after the Sponsor uploads a protocol.',
    stepsTitle: 'Your part in each study',
    steps: [
      ['Approve the protocol rules', 'Check each rule against its page in the protocol, then approve.'],
      ['Screen patients', 'See who meets the criteria, who needs review and why.'],
      ['Review safety cases', 'New records that conflict with the protocol are routed to you.'],
      ['Audit trail', 'Every action is recorded, with the full technical record.'],
    ],
  },
};

function StudyCard({ study }: { study: Trial }) {
  return (
    <Link href={`/trials/${encodeURIComponent(study.trial_id)}`} className="block rounded-xl border border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-line-strong hover:bg-canvas">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-bold">{displayTitle(study.title)}</span>
        {study.active_protocol_version_id ? <Pill tone="pass">Protocol approved</Pill> : <Pill tone="unknown">No approved protocol</Pill>}
      </span>
      <span className="mt-2.5 flex flex-wrap gap-x-7 gap-y-1.5">
        <span><span className="block text-xs text-ink-muted">Planned dates</span>{formatDay(study.planned_start_date)} – {formatDay(study.planned_end_date)}</span>
        <span><span className="block text-xs text-ink-muted">Site time zone</span>{study.site_timezone}</span>
      </span>
      <span className="mt-3 flex items-center gap-1.5 font-semibold text-brand">
        Open study
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10" /><path d="m9 4 4 4-4 4" /></svg>
      </span>
    </Link>
  );
}

function Steps({ title, steps }: { title: string; steps: string[][] }) {
  return (
    <section className="card p-6" aria-labelledby="steps-heading">
      <h2 id="steps-heading" className="mb-3.5 text-base">{title}</h2>
      <ol className="space-y-3.5">
        {steps.map(([name, detail], i) => (
          <li key={name} className="flex gap-3">
            <span aria-hidden="true" className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[13px] font-bold ${i === 0 ? 'bg-brand text-white' : 'bg-brand-soft text-brand'}`}>{i + 1}</span>
            <span><span className="block font-semibold">{name}</span><span className="block text-ink-muted">{detail}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// First screen for both roles: a role-specific welcome, the studies the role can open and,
// for the Sponsor, a way to start a new study straight from its protocol PDF.
export function Landing() {
  const { actor } = useActor();
  const sponsor = actor.role !== 'INVESTIGATOR';
  const copy = sponsor ? COPY.COORDINATOR : COPY.INVESTIGATOR;
  const studies = useApiQuery(listAllTrials, [actor.actor_id]);

  const list: ReactNode = (
    <section className={`card p-6 ${sponsor ? '' : 'shadow-lg sm:p-7'}`} aria-labelledby="studies-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="studies-heading" className="text-xl">{copy.listTitle}</h2>
        {studies.data && studies.data.length > 0 && <span className="text-xs text-ink-muted">{studies.data.length} {studies.data.length === 1 ? 'study' : 'studies'}</span>}
      </div>
      <div className="mt-3.5 space-y-3">
        {studies.loading && !studies.data && <LoadingSkeleton rows={2} label="Loading studies" />}
        {studies.error ? <ErrorPanel error={studies.error} context="Could not load studies" onRetry={studies.reload} /> : null}
        {studies.data?.map((study) => <StudyCard key={study.trial_id} study={study} />)}
        {studies.data?.length === 0 && <EmptyState title="No studies yet">{copy.empty}</EmptyState>}
      </div>
      {sponsor && studies.data && studies.data.length > 0 && <p className="mt-3.5 text-xs text-ink-muted">To add a new protocol version to an ongoing study, open it and go to Protocol.</p>}
    </section>
  );

  return (
    <div className="-mt-6">
      <section className="hero-band px-0 pb-24 pt-11" aria-labelledby="landing-title">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#bfe3cf]">{copy.eyebrow}</p>
        <h1 id="landing-title" className="text-[34px] leading-tight text-white">{copy.title}</h1>
        <p className="mt-2.5 max-w-2xl text-base text-brand-soft">{copy.intro}</p>
      </section>
      <div className="relative -mt-16 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {sponsor ? <NewStudyForm /> : list}
        <div className="space-y-4">
          {sponsor && list}
          <Steps title={copy.stepsTitle} steps={copy.steps} />
        </div>
      </div>
    </div>
  );
}
