import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curio.app',
  appName: 'Curio',
  webDir: 'dist',
  server: {
    url: 'http://localhost:3000',
    cleartext: true,
  },
};

export default config;
