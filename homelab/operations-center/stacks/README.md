# Ready-to-run stacks

Copy-paste Docker Compose for the 10 most useful catalog apps, each
self-contained and pre-set to the ports the Operations Center dashboard
(`../dashboard/config/services.yaml`) already expects. Run on the NAS, reach over
Tailscale, never expose to the internet.

## How to deploy one

```bash
# On the NAS (over Tailscale SSH), per app:
cd <app>
cp .env.example .env && $EDITOR .env     # only the apps that ship a .env.example
docker compose up -d
docker compose logs -f
```

Each compose file's header has the exact steps, the URL, and what to edit
(media paths, secrets, GPU, etc.). Runtime data is written into a `./data`-style
folder next to the compose file and is gitignored.

## Port map

| App | URL (tailnet) | Needs `.env` | Notes |
|---|---|---|---|
| **Uptime Kuma** | http://nas:3001 | no | Create admin on first load. |
| **Vaultwarden** | http://nas:8084 | yes | Set `ADMIN_TOKEN`; lock signups after registering. |
| **Jellyfin** | http://nas:8096 | no | Edit media paths; optional iGPU transcode. |
| **FileBrowser** | http://nas:8081 | no | Default `admin/admin` — change immediately. |
| **Paperless-ngx** | http://nas:8085 | yes | Postgres + Redis + OCR; drop files in `./consume`. |
| **Immich** | http://nas:2283 | yes | Postgres + Redis + ML; set photo/db paths. |
| **Home Assistant** | http://nas:8123 | no | Uses host networking for device discovery. |
| **Ollama + Open WebUI** | http://nas:3080 | no | 100% local LLM chat; `ollama pull` a model first. |
| **Dozzle** | http://nas:8888 | no | Live container logs; socket mounted read-only. |
| **AdGuard Home** | http://nas:8053 | no | First-run wizard; DNS on port 53 for your LAN. |

> Ports already match the dashboard tiles, so each app lights up in the
> Operations Center as soon as it's running. Add more from `../catalog/`.

## Conventions

- **All local & tailnet-only.** No SaaS, no public ports. Tailscale is the
  perimeter; the WireGuard tunnel encrypts traffic between your devices.
- **Secrets in `.env`, never committed.** Generate strong values
  (`openssl rand -base64 48`) where the comments say so.
- **Edit the paths.** Bind mounts point at `/volume1/...` placeholders — change
  them to match your UGOS volumes.
- **Pin versions for stability.** These use rolling tags (`latest`/`release`) for
  a quick start; pin to a specific version once you settle in, and pair with
  Watchtower/Diun (see `../catalog/`) for controlled updates.
