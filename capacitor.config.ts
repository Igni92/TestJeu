import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monile.game',
  appName: 'Mon Île',
  webDir: 'dist',
  backgroundColor: '#0b1220',
  server: {
    androidScheme: 'https',
  },
};

export default config;
