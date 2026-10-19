import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

export default defineConfig({
  output: 'server',
  site: env.SITE_URL || process.env.SITE_URL || 'http://localhost:4321',

  integrations: [react()],

  adapter: vercel(),

  security: {
    checkOrigin: true,
  },

  env: {
    schema: {
      TURSO_DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      TURSO_AUTH_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret', min: 32 }),
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'public' }),
      SITE_URL: envField.string({ context: 'server', access: 'public' }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
