#!/usr/bin/env bash
#
# backup-to-nas.sh — incremental backup of selected PC folders to the NAS
# over Tailscale SSH using rsync. Safe to run repeatedly; only changes transfer.
#
# Config comes from backup.env (copy backup.env.example -> backup.env and edit).
# Run manually:   ./backup-to-nas.sh
# Run on a timer: see backup-to-nas.service / backup-to-nas.timer
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKUP_ENV:-$SCRIPT_DIR/backup.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: config file not found: $ENV_FILE" >&2
  echo "Copy backup.env.example to backup.env and edit it." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${NAS_HOST:?set NAS_HOST in backup.env (e.g. nas)}"
: "${NAS_USER:?set NAS_USER in backup.env}"
: "${NAS_DEST_PATH:?set NAS_DEST_PATH in backup.env (e.g. /volume1/backups/pc)}"
: "${SOURCES:?set SOURCES in backup.env (space-separated list of paths)}"

LOG_TAG="backup-to-nas"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Verify the NAS is reachable before doing anything.
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "${NAS_USER}@${NAS_HOST}" true 2>/dev/null; then
  log "ERROR: cannot SSH to ${NAS_USER}@${NAS_HOST}. Is Tailscale up on both ends?"
  exit 1
fi

# Make sure the destination exists on the NAS.
ssh "${NAS_USER}@${NAS_HOST}" "mkdir -p '${NAS_DEST_PATH}'"

RSYNC_OPTS=(
  -a                      # archive: perms, times, symlinks, recursive
  --human-readable
  --partial               # resume interrupted transfers
  --delete                # mirror: remove files on NAS that were deleted locally
  --delete-excluded
)

# Optional excludes file (one pattern per line), e.g. node_modules, *.tmp
if [[ -n "${EXCLUDE_FILE:-}" && -f "$EXCLUDE_FILE" ]]; then
  RSYNC_OPTS+=(--exclude-from="$EXCLUDE_FILE")
fi

[[ "${DRY_RUN:-0}" == "1" ]] && RSYNC_OPTS+=(--dry-run) && log "DRY RUN — no changes will be written"

log "Starting backup to ${NAS_USER}@${NAS_HOST}:${NAS_DEST_PATH}"
rc=0
for src in $SOURCES; do
  if [[ ! -e "$src" ]]; then
    log "WARN: source does not exist, skipping: $src"
    continue
  fi
  log "Syncing: $src"
  # Trailing slash semantics: we replicate the source dir *by name* under dest,
  # so /home/me/Documents -> NAS:/.../pc/Documents
  if rsync "${RSYNC_OPTS[@]}" "$src" "${NAS_USER}@${NAS_HOST}:${NAS_DEST_PATH}/"; then
    log "OK: $src"
  else
    log "ERROR syncing: $src"
    rc=1
  fi
done

if [[ "$rc" -eq 0 ]]; then
  log "Backup completed successfully."
else
  log "Backup completed WITH ERRORS."
fi
exit "$rc"
