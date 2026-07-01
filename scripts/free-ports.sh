#!/usr/bin/env bash
# Kill processes blocking Chai Khata ports (3001 auth, 5173/5174 vite)
set -e
cd "$(dirname "$0")/.."

echo "Freeing ports 3001, 5173, 5174..."
for port in 3001 5173 5174; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    pid=$(lsof -t -i:"${port}" 2>/dev/null || true)
    if [ -n "$pid" ]; then kill $pid 2>/dev/null || true; fi
  fi
done
echo "Done. Now run: npm run dev"
