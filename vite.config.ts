import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
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
        "img-src 'self' blob: data: https:",
        `connect-src ${connectSrc}`,
        "media-src 'self' blob:",
        "object-src 'none'",
        "frame-src 'none'",
      ].join('; ');

      return html.replace('__CSP_CONTENT__', csp);
    },
  };
}

function swCacheVersionPlugin(): Plugin {
  return {
    name: 'curio-sw-cache-version',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (!fs.existsSync(swPath)) return;
      const buildHash = crypto.randomBytes(4).toString('hex');
      let content = fs.readFileSync(swPath, 'utf8');
      content = content.replace('curio-shell-v4', `curio-shell-${buildHash}`);
      fs.writeFileSync(swPath, content, 'utf8');
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
    plugins: [react(), cspPlugin(), swCacheVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
