import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chaikhata.app',
  appName: 'Chai Khata',
  webDir: 'dist',
  server: {
    // Live cloud API + site — phone APK syncs here (not localhost)
    allowNavigation: [
      'https://patiwala.pk/*',
      'https://*.patiwala.pk/*',
      'https://*.vercel.app/*',
    ],
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
