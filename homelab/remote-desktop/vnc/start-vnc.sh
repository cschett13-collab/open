#!/usr/bin/env bash
#
# start-vnc.sh — start a VNC server bound to the Tailscale interface ONLY.
#
# Auto-detects Wayland (wlroots -> wayvnc) vs X11 (-> x11vnc) and refuses to
# listen on anything but your 100.x.y.z tailnet address, so the desktop is
# reachable only from your own devices over Tailscale.
#
# Usage:   ./start-vnc.sh
# Env overrides:
#   VNC_PORT      (default 5900)
#   VNC_SERVER    force "wayvnc" or "x11vnc" instead of auto-detect
#   X11_DISPLAY   X display for x11vnc (default :0)
#   VNCPASSFILE   x11vnc password file (default ~/.config/homelab/vncpasswd)
#
set -euo pipefail

VNC_PORT="${VNC_PORT:-5900}"
X11_DISPLAY="${X11_DISPLAY:-:0}"
VNCPASSFILE="${VNCPASSFILE:-$HOME/.config/homelab/vncpasswd}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 1. Find the Tailscale IPv4 address; bail if Tailscale isn't up.
if ! command -v tailscale >/dev/null 2>&1; then
  echo "ERROR: tailscale not found on PATH." >&2
  exit 1
fi
TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [[ -z "$TS_IP" ]]; then
  echo "ERROR: no Tailscale IPv4 address. Is Tailscale up? Try: sudo tailscale up" >&2
  exit 1
fi
log "Binding VNC to tailnet address only: ${TS_IP}:${VNC_PORT}"

# 2. Decide which server to run.
server="${VNC_SERVER:-}"
if [[ -z "$server" ]]; then
  case "${XDG_SESSION_TYPE:-}" in
    wayland) server="wayvnc" ;;
    x11)     server="x11vnc" ;;
    *)
      # Fall back to whatever is installed.
      if command -v wayvnc >/dev/null 2>&1; then server="wayvnc"
      elif command -v x11vnc >/dev/null 2>&1; then server="x11vnc"
      else
        echo "ERROR: could not detect session type and neither wayvnc nor x11vnc is installed." >&2
        exit 1
      fi
      ;;
  esac
fi
log "Using VNC server: ${server}"

# 3. Launch, bound to the tailnet IP.
case "$server" in
  wayvnc)
    command -v wayvnc >/dev/null 2>&1 || { echo "ERROR: wayvnc not installed." >&2; exit 1; }
    # wayvnc takes the bind address and port as positional args.
    # Auth/credentials come from ~/.config/wayvnc/config (see README).
    exec wayvnc "$TS_IP" "$VNC_PORT"
    ;;
  x11vnc)
    command -v x11vnc >/dev/null 2>&1 || { echo "ERROR: x11vnc not installed." >&2; exit 1; }
    if [[ ! -f "$VNCPASSFILE" ]]; then
      echo "ERROR: VNC password file not found: $VNCPASSFILE" >&2
      echo "Create it with: x11vnc -storepasswd \"$VNCPASSFILE\"" >&2
      exit 1
    fi
    exec x11vnc \
      -rfbauth "$VNCPASSFILE" \
      -listen "$TS_IP" \
      -rfbport "$VNC_PORT" \
      -display "$X11_DISPLAY" \
      -forever -shared -noxdamage
    ;;
  *)
    echo "ERROR: unknown VNC_SERVER '$server' (expected wayvnc or x11vnc)." >&2
    exit 1
    ;;
esac
