# Dashboard — the Operations Center UI

A [Homepage](https://gethomepage.dev) instance on the NAS that links to every
homelab service and shows live status, reached at **http://nas:3000** over your
tailnet.

## Setup

```bash
# On the NAS (over Tailscale SSH):
mkdir -p /volume1/docker/operations-center
cd /volume1/docker/operations-center
# copy this folder (docker-compose.yml, .env.example, config/) here, then:
cp .env.example .env
$EDITOR .env                      # set PUID/PGID/TZ and HOMEPAGE_ALLOWED_HOSTS
docker compose up -d
docker compose logs -f operations-center
```

Open **http://nas:3000** from any device on the tailnet.

## Make it yours

Everything is YAML in `config/`:

| File | Controls |
|---|---|
| `settings.yaml` | Title, theme, group layout/order. |
| `services.yaml` | The tiles — grouped links to your services (pre-wired to this kit; edit hosts/ports). |
| `widgets.yaml` | Top-of-page info (clock, host CPU/RAM/disk, search). |
| `bookmarks.yaml` | Quick links (incl. this repo's docs). |
| `docker.yaml` | Optional live container status on tiles. |

Add a service:

1. Run it (see `../catalog/` for 100+ options and `../../nas-docker/` for the stack).
2. Add a tile under the right group in `services.yaml`:
   ```yaml
   - Apps:
       - My New App:
           icon: mdi-rocket
           href: http://nas:1234
           description: what it does
   ```
3. Homepage hot-reloads — refresh the page.

Icons: use a name from [dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
(e.g. `jellyfin.png`) or any Material Design Icon as `mdi-<name>`.

## Allowed hosts

Recent Homepage versions reject requests whose `Host` header isn't allow-listed.
If you get a blank page or a "host not allowed" error, add the name/IP you're
using to `HOMEPAGE_ALLOWED_HOSTS` in `.env` (e.g. `nas:3000,100.64.0.5:3000`)
and `docker compose up -d` again.

## Security

- **Tailnet-only.** Don't forward port 3000 to the internet. Gate it further with
  the ACL patterns in `../../remote-desktop/tailscale-acl.snippet.json`.
- The Docker socket is mounted **read-only** and only for the optional status
  widget — remove that volume in `docker-compose.yml` if you'd rather not.
