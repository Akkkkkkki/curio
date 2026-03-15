import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function cspPlugin(): Plugin {
  let apiOrigin = '';

  return {
    name: 'curio-csp',
    configResolved(config) {
      const raw = config.env?.VITE_API_BASE_URL ?? '';
      if (raw) {
        try {
          const url = new URL(raw);
          apiOrigin = url.origin;
        } catch {
          // Relative or invalid — 'self' already covers it
        }
      }
    },
    transformIndexHtml(html) {
      const connectSrc = [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        ...(apiOrigin ? [apiOrigin] : []),
      ].join(' ');

      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' blob: data: https://*.supabase.co",
        `connect-src ${connectSrc}`,
        "media-src 'self' blob:",
        "object-src 'none'",
        "frame-src 'none'",
      ].join('; ');

      return html.replace('__CSP_CONTENT__', csp);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), cspPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
