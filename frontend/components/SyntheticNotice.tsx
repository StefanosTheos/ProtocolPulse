import { API_BASE_URL_LABEL, API_MODE } from '@/lib/api/runtime';

export function SyntheticNotice() {
  return (
    <div className="border-b border-line bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-xs">
        <strong className="font-semibold tracking-wide">FICTIONAL PROTOCOL · SYNTHETIC PATIENTS ONLY</strong>
        <span className="text-white/80">Pre-screening support. Not a diagnosis, enrollment or treatment decision. Clinical decisions stay with investigators.</span>
      </div>
      {API_MODE === 'mock' && (
        <div role="note" className="bg-unknown-bg text-unknown-fg">
          <div className="mx-auto max-w-7xl px-4 py-1.5 text-xs font-medium">
            MOCK MODE: responses come from an in-memory mock of the API contract, not the ProtocolPulse backend.
            Nothing shown here was produced by the evaluator, a model or a clinician.
          </div>
        </div>
      )}
      {API_MODE === 'unconfigured' && (
        <div role="alert" className="bg-fail-bg text-fail-fg">
          <div className="mx-auto max-w-7xl px-4 py-1.5 text-xs font-medium">
            API not configured ({API_BASE_URL_LABEL}). Set NEXT_PUBLIC_API_BASE_URL in frontend/.env.local.
          </div>
        </div>
      )}
    </div>
  );
}
