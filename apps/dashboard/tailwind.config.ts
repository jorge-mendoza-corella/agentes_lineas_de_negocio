import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a5f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
