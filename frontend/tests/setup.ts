import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, vi } from 'vitest';
import { setApiForTesting, setCurrentActorId } from '@/lib/api/runtime';

if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// Next.js router primitives are not available outside the framework; tests drive params explicitly.
export const navigation = {
  params: {} as Record<string, string>,
  search: new URLSearchParams(),
  pathname: '/',
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useParams: () => navigation.params,
  useSearchParams: () => navigation.search,
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push, back: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  setApiForTesting(null);
  setCurrentActorId('ACT-INV-01');
  navigation.params = {};
  navigation.search = new URLSearchParams();
  navigation.pathname = '/';
  navigation.replace.mockReset();
  navigation.push.mockReset();
});
