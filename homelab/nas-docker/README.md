# NAS Docker stack

Runs on the UGREEN NAS. Provides Syncthing (file sync) and, optionally,
Tailscale-in-a-container if your UGOS firmware lacks the native Tailscale app.

## Deploy

1. Confirm Docker is enabled in UGOS (App Center → Docker / Container Station).
2. Copy this `nas-docker/` folder to the NAS, e.g. `/volume1/docker/homelab`.
3. Find your user/group ids on the NAS:
   ```bash
   id          # note uid= and gid=
   ```
4. Configure:
   ```bash
   cp .env.example .env
   $EDITOR .env        # set PUID/PGID/TZ and the *_ROOT paths
   ```
5. Bring it up:
   ```bash
   docker compose up -d
   docker compose ps
   ```
6. Open the Syncthing UI from your PC: `http://nas:8384` (works over Tailscale).

## Tailscale container — use it or not?

- **UGOS has the native Tailscale app** → install that instead, and delete/comment
  the `tailscale:` service in `docker-compose.yml`.
- **No native app** → keep the service, generate a reusable auth key in the
  Tailscale admin console, and put it in `.env` as `TS_AUTHKEY`. The container
  joins your tailnet as `nas` with Tailscale SSH enabled.

## Adding more apps later

This stack is a starting point. Common next additions (just ask and I'll wire
them in with sane volumes/ports):
- **Jellyfin / Plex** — media server
- **Immich** — self-hosted photo backup (great paired with phone)
- **Nextcloud** — files/calendar/contacts
- **Uptime Kuma** — monitor your services
