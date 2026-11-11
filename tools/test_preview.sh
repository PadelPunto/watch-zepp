#!/usr/bin/env bash
# Puts the current state on the watch as "PP Test", next to the real Padel Punto from the Zepp App
# Store: its own appId (1132341), the name "PP Test" and the orange TEST icon, so the store app,
# its matches and its updates stay untouched. The test app has its own storage (history, options,
# tablet pairing). app.json and the icon are changed only while this runs and put back afterwards,
# also when it fails or is stopped.
# Usage: npm run preview-test          (zeus preview: pick the watch, scan the QR code)
#        bash tools/test_preview.sh --dry   only shows what would change, installs nothing
set -euo pipefail
cd "$(dirname "$0")/.."

REAL_ID=1132340
TEST_ID=1132341
ICON=assets/default.s/icon.png

grep -q "\"appId\": $REAL_ID" app.json || { echo "app.json does not have appId $REAL_ID - is a test run still open?"; exit 1; }

saved=$(mktemp -d)
cp -p app.json "$saved/app.json"
cp -p "$ICON" "$saved/icon.png"
cp .gitignore "$saved/gitignore"
restore() {
  cp -p "$saved/app.json" app.json
  cp -p "$saved/icon.png" "$ICON"
  cp "$saved/gitignore" .gitignore
  rm -rf "$saved"
}
trap restore EXIT

sed -i "s/\"appId\": $REAL_ID/\"appId\": $TEST_ID/; s/\"appName\": \"Padel Punto\"/\"appName\": \"PP Test\"/" app.json
cp tools/test_icon.png "$ICON"

if [ "${1:-}" = --dry ]; then
  git diff --stat -- app.json "$ICON"
  grep -n '"appId"\|"appName"' app.json
  exit 0
fi

echo "Installing as PP Test (appId $TEST_ID). The real Padel Punto on the watch stays as it is."
zeus preview
