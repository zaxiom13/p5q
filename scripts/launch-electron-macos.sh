#!/bin/zsh

set -euo pipefail

"$(cd "$(dirname "$0")" && pwd)/launch-desktop-runtime-macos.sh" electron
