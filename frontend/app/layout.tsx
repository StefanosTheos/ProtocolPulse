import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ActorProvider } from '@/components/ActorContext';
import { AppHeader } from '@/components/AppHeader';
import { EnvironmentNotice } from '@/components/EnvironmentNotice';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'ProtocolPulse',
  description: 'Protocol-based patient pre-screening and safety review for clinical trials.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">Skip to content</a>
        <ActorProvider>
          <EnvironmentNotice />
          <AppHeader />
          <main id="main" className="mx-auto max-w-7xl px-4 py-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-ink-muted">
            Decision support only. Final eligibility and clinical decisions rest with the Clinical Lead.
          </footer>
        </ActorProvider>
      </body>
    </html>
  );
}
