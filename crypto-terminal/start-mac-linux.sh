#!/usr/bin/env bash
# ============================================================
#   Alpha Terminal - one-click start for Mac / Linux
#   Run it from a terminal:   ./start-mac-linux.sh
#   (or double-click it, then choose "Run in Terminal")
# ============================================================
set -e
cd "$(dirname "$0")"

# --- Check that Node.js is installed ------------------------
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js is not installed yet."
  echo
  echo "  Install it from https://nodejs.org (download the LTS version),"
  echo "  then run this script again."
  echo
  exit 1
fi

# --- OPTIONAL: turn on the RTX 5090 local AI briefing -------
# If you installed Ollama (https://ollama.com) and ran:  ollama pull llama3
# then remove the leading '#' on the next two lines:
# export ALPHA_AI=ollama
# export ALPHA_AI_MODEL=llama3

echo
echo "  Starting Alpha Terminal... leave this window open."
echo "  Press Ctrl+C to stop."
echo

exec node start.js
