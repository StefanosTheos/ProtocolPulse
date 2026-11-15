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

// The candidate list address (tab, reason filter, sort, search) the user last looked at, so
// "All candidates" on a patient page returns to the same list instead of the default view.
const listKey = (trialId: string) => `protocolpulse.listUrl.${trialId}`;

export function rememberListUrl(trialId: string, url: string): void {
  try { window.sessionStorage.setItem(listKey(trialId), url); } catch { /* storage unavailable */ }
}

export function getListUrl(trialId: string, runId: string | null): string | null {
  try {
    const url = window.sessionStorage.getItem(listKey(trialId));
    if (!url) return null;
    const run = new URL(url, 'http://x').searchParams.get('run');
    return !runId || run === runId ? url : null;
  } catch { return null; }
}
