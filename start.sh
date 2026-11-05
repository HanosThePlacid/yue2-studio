#!/usr/bin/env bash
# Start YuE2 Studio (production build). Run ./install.sh first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/app"
[[ -f build/index.js ]] || npm run build
exec npm start
