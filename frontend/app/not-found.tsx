import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card card-pad mx-auto max-w-xl space-y-3 text-center">
      <h1>Page not found</h1>
      <p className="text-ink-muted">The address may be mistyped, or the page has moved.</p>
      <Link href="/" className="btn-primary">Go to studies</Link>
    </div>
  );
}
