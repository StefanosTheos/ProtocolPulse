import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
export default [
  { ignores: ['.next/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  ...compat.extends('next/core-web-vitals'),
];
