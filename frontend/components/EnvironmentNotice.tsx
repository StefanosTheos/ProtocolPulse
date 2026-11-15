import { API_MODE } from '@/lib/api/runtime';

// Developer-only setup notes. Nothing is shown in a production build.
export function EnvironmentNotice() {
  if (process.env.NODE_ENV === 'production' || API_MODE === 'live') return null;
  return (
    <div role="note" className="border-b border-unknown-line bg-unknown-bg text-unknown-fg">
      <div className="mx-auto max-w-7xl px-4 py-1.5 text-xs font-medium">
        {API_MODE === 'mock'
          ? 'Development: responses come from the in-memory mock, not the backend.'
          : 'Development: the API is not configured. Set NEXT_PUBLIC_API_BASE_URL in frontend/.env.local.'}
      </div>
    </div>
  );
}
