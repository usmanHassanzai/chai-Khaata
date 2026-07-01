#!/usr/bin/env bash
# Checks whether this machine can build the Chai Khata Android app.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Chai Khata — Android build check ==="
echo

ok=true

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "✔ $1"
  else
    echo "✘ $1"
    ok=false
  fi
}

check "Node.js installed" "command -v node"
check "npm installed" "command -v npm"
check "Web build exists (dist/)" "test -d dist/index.html || test -f dist/index.html"
check "Android project exists (android/)" "test -d android"
check "Java (JDK) installed" "command -v java"
check "Android SDK (ANDROID_HOME or sdk.dir)" "test -n \"\${ANDROID_HOME:-}\" || test -f android/local.properties"

studio_paths=(
  "/usr/local/android-studio/bin/studio.sh"
  "$HOME/android-studio/bin/studio.sh"
  "/opt/android-studio/bin/studio.sh"
  "/snap/bin/android-studio"
)

studio_found=false
for p in "${studio_paths[@]}"; do
  if [ -x "$p" ]; then
    echo "✔ Android Studio found at: $p"
    studio_found=true
    break
  fi
done
if [ "$studio_found" = false ]; then
  echo "✘ Android Studio not found (needed for 'npx cap open android')"
  ok=false
fi

if [ -f android/gradlew ]; then
  if [ -n "${ANDROID_HOME:-}" ] && command -v java >/dev/null 2>&1; then
    echo
    echo "Try building APK from terminal:"
    echo "  npm run build && npx cap sync"
    echo "  cd android && ./gradlew assembleDebug"
    echo "  APK: android/app/build/outputs/apk/debug/app-debug.apk"
  fi
fi

echo
if [ "$ok" = true ]; then
  echo "All checks passed. Run: npx cap open android"
else
  echo "Some requirements are missing. See README.md → Android setup (Ubuntu)."
  echo
  echo "Quick options:"
  echo "  1) Install Android Studio: https://developer.android.com/studio"
  echo "  2) Use PWA on phone (no Android Studio): npm run dev -- --host"
  echo "     then open http://YOUR-PC-IP:5173 on Android Chrome → Add to Home screen"
fi
