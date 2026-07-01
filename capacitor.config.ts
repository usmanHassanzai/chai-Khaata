import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chaikhata.app',
  appName: 'Chai Khata',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
