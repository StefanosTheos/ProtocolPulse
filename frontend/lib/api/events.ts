// A tiny in-page signal so the persistent trial header refreshes after any change that affects it
// (protocol approved, screening run, participation recorded, record added, case updated).
const EVENT = 'protocolpulse:trial-changed';

export function notifyTrialChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function onTrialChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
