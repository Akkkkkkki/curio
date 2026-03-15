import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curio.app',
  appName: 'Curio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#111827',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Camera: {
      presentationStyle: 'fullScreen',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#111827',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#111827',
  },
};

export default config;
