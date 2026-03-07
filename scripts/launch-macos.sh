#!/bin/zsh

set -euo pipefail

ROOT="/Users/zak1726/Desktop/p5q"
LOG_DIR="${HOME}/Library/Logs/p5q-studio"
LOG_FILE="${LOG_DIR}/launch.log"
export PATH="${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

mkdir -p "$LOG_DIR"

cd "$ROOT"
nohup /opt/homebrew/bin/npm start >>"$LOG_FILE" 2>&1 &
