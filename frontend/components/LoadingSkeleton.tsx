export function LoadingSkeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-line motion-reduce:animate-none" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
