#!/bin/zsh

set -euo pipefail

ROOT="/Users/zak1726/Desktop/Qanvas5"
LOG_DIR="${HOME}/Library/Logs/qanvas5-studio"
export PATH="${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
NODE_BIN="$(command -v node || true)"

RUNTIME="${1:-}"

if [[ -z "$RUNTIME" ]]; then
  echo "usage: $0 <electron|electrobun>" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

if [[ -z "$NODE_BIN" ]]; then
  /usr/bin/osascript -e 'display dialog "Node.js is required to launch Qanvas5 Studio from this shortcut." buttons {"OK"} default button "OK" with title "Qanvas5 Studio"'
  exit 1
fi

case "$RUNTIME" in
  electron)
    LOG_FILE="${LOG_DIR}/launch-electron.log"
    ;;
  electrobun)
    LOG_FILE="${LOG_DIR}/launch-electrobun.log"
    if [[ ! -x "${ROOT}/node_modules/.bin/electrobun" ]]; then
      /usr/bin/osascript -e 'display dialog "Electrobun launcher needs the local electrobun package installed in this repo first." buttons {"OK"} default button "OK" with title "Qanvas5 Electrobun"'
      exit 1
    fi
    ;;
  *)
    echo "unknown runtime: $RUNTIME" >&2
    exit 1
    ;;
esac

cd "$ROOT"
nohup env \
  QANVAS5_DESKTOP_RUNTIME="$RUNTIME" \
  QANVAS5_SOURCE_ROOT="$ROOT" \
  "$NODE_BIN" "$ROOT/scripts/start-desktop.js" >>"$LOG_FILE" 2>&1 </dev/null &
