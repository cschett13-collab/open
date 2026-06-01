#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
	exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Install dependencies. `npm install` (not `npm ci`) so the cached container
# state can be reused on subsequent runs. This repo sets package-lock=false,
# so there is no lockfile to honor.
npm install
