/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0F19',
        surface: '#111827',
        'surface-2': '#1E293B',
        violet: '#8B5CF6',
        cyan: '#06B6D4',
        emerald: '#10B981',
        amber: '#F59E0B',
        text: '#F9FAFB',
        'text-muted': '#94A3B8',
        'text-dim': '#475569',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
