import type { Config } from 'tailwindcss';

// Restrained clinical-operations palette. Status hues always pair with a text label;
// colour is never the only signal (NFR-011).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1c2430', muted: '#4a5565', faint: '#566173' },
        line: { DEFAULT: '#d9dee5', strong: '#b8c0cc' },
        canvas: '#f5f6f8',
        surface: '#ffffff',
        brand: { DEFAULT: '#1f4e79', hover: '#173d60', soft: '#e6eef6' },
        pass: { fg: '#1d5c3a', bg: '#e3f1e8', line: '#a8d1b7' },
        fail: { fg: '#8a1f2b', bg: '#fbe7e9', line: '#eab0b7' },
        unknown: { fg: '#7a4b00', bg: '#fdf1d8', line: '#ebcd8e' },
        info: { fg: '#24476b', bg: '#e6eef6', line: '#b3c8de' },
        neutral: { fg: '#3d4654', bg: '#eceff3', line: '#cdd3db' },
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
