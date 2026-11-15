// The API has no "latest screening run" route, so the browser remembers the last completed run
// per trial. Tabs and links that carry no ?run= fall back to it instead of showing an empty list.
const key = (trialId: string) => `protocolpulse.lastRun.${trialId}`;

export function getLastRun(trialId: string): string | null {
  try { return window.localStorage.getItem(key(trialId)); } catch { return null; }
}

export function rememberRun(trialId: string, runId: string): void {
  try { window.localStorage.setItem(key(trialId), runId); } catch { /* storage unavailable */ }
}

export function forgetRun(trialId: string, runId: string): void {
  try { if (window.localStorage.getItem(key(trialId)) === runId) window.localStorage.removeItem(key(trialId)); } catch { /* storage unavailable */ }
}
