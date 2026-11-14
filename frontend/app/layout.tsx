import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ActorProvider } from '@/components/ActorContext';
import { AppHeader } from '@/components/AppHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SyntheticNotice } from '@/components/SyntheticNotice';

export const metadata: Metadata = {
  title: 'ProtocolPulse',
  description: 'Protocol-grounded pre-screening and monitoring review on fictional, synthetic data.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">Skip to content</a>
        <ActorProvider>
          <SyntheticNotice />
          <AppHeader />
          <main id="main" className="mx-auto max-w-7xl px-4 py-5">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </ActorProvider>
      </body>
    </html>
  );
}
