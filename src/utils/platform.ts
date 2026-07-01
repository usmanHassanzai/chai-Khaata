import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function initPlatformClasses() {
  const root = document.documentElement;
  if (isNativeApp()) {
    root.classList.add('native-app');
    const platform = Capacitor.getPlatform();
    root.classList.add(`platform-${platform}`);
  }
}
