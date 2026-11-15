import type { Config } from 'tailwindcss';

// Calm green clinical palette. Status hues always pair with a text label;
// colour is never the only signal (NFR-011).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a2d25', muted: '#475c51', faint: '#52665b' },
        line: { DEFAULT: '#d5e5db', strong: '#b9cec1' },
        canvas: '#f0f7f2',
        surface: '#ffffff',
        brand: { DEFAULT: '#14523c', hover: '#0e3f2e', soft: '#dff1e7' },
        pass: { fg: '#1f6b4a', bg: '#e6f4ec', line: '#b5dcc6' },
        fail: { fg: '#a12c36', bg: '#fcebec', line: '#f0bfc4' },
        unknown: { fg: '#8a5a00', bg: '#fff4dc', line: '#eed39a' },
        info: { fg: '#24557a', bg: '#e7f0f8', line: '#bbd2e6' },
        neutral: { fg: '#3d4654', bg: '#e6eee9', line: '#c9d6ce' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: { '2xs': ['0.6875rem', '1rem'] },
    },
  },
  plugins: [],
};

export default config;
