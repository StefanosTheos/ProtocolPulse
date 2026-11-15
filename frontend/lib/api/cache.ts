// Browser-memory freshness signal. No clinical data is persisted in storage.
let revision = 0;
const listeners = new Set<() => void>();

export const getReadRevision = () => revision;
export function subscribeReads(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function invalidateReads() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
