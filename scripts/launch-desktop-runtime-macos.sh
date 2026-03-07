#!/bin/zsh

set -euo pipefail

ROOT="/Users/zak1726/Desktop/p5q"
LOG_DIR="${HOME}/Library/Logs/p5q-studio"
export PATH="${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

RUNTIME="${1:-}"

if [[ -z "$RUNTIME" ]]; then
  echo "usage: $0 <electron|electrobun>" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

case "$RUNTIME" in
  electron)
    LOG_FILE="${LOG_DIR}/launch-electron.log"
    ;;
  electrobun)
    LOG_FILE="${LOG_DIR}/launch-electrobun.log"
    if [[ ! -x "${ROOT}/node_modules/.bin/electrobun" ]]; then
      /usr/bin/osascript -e 'display dialog "Electrobun launcher needs the local electrobun package installed in this repo first." buttons {"OK"} default button "OK" with title "p5q Electrobun"'
      exit 1
    fi
    ;;
  *)
    echo "unknown runtime: $RUNTIME" >&2
    exit 1
    ;;
esac

cd "$ROOT"
nohup env P5Q_DESKTOP_RUNTIME="$RUNTIME" /opt/homebrew/bin/npm start >>"$LOG_FILE" 2>&1 &
