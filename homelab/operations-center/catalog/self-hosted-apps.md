# Self-hosted app catalog — 100+ all-local options

A curated menu of actively-maintained projects you can run **on your own
hardware** (NAS or PC) and reach **over Tailscale**. Nothing here depends on a
third-party cloud. Each is Docker-friendly, so it drops into your
`../../nas-docker/` stack and gets a tile in `../dashboard/config/services.yaml`.

Legend: 🐳 official/community Docker image · 🌐 has a web UI · ⚡ lightweight
(runs happily on a NAS).

---

## 1. Dashboards & control planes
| App | What it does |
|---|---|
| **Homepage** 🐳🌐⚡ | The dashboard this kit ships (`../dashboard/`). YAML-config, live widgets. |
| **Homarr** 🐳🌐 | Drag-and-drop dashboard with integrations and a config UI. |
| **Heimdall** 🐳🌐⚡ | Simple app-launcher dashboard. |
| **Dashy** 🐳🌐 | Highly customizable dashboard with status checks and themes. |
| **Glance** 🐳🌐⚡ | Fast YAML dashboard with feeds, monitors, and widgets. |
| **Flame** 🐳🌐⚡ | Minimal "start page" with app + bookmark management. |
| **Organizr** 🐳🌐 | Tabbed HTPC/homelab portal that frames your other apps. |

## 2. Remote access & networking
| App | What it does |
|---|---|
| **Tailscale** 🐳 | The mesh VPN this whole kit is built on (WireGuard). |
| **Headscale** 🐳⚡ | Self-hosted Tailscale control server — run your own coordinator. |
| **NetBird** 🐳 | Open-source WireGuard mesh with its own control plane. |
| **ZeroTier** 🐳 | Alternative SD-WAN/mesh overlay network. |
| **WireGuard** (wg-easy) 🐳🌐⚡ | Classic WireGuard with an easy web UI. |
| **RustDesk server** 🐳⚡ | Self-hosted remote-desktop relay (`../../remote-desktop/rustdesk/`). |
| **Apache Guacamole** 🐳🌐 | Clientless RDP/VNC/SSH gateway in the browser. |
| **MeshCentral** 🐳🌐 | Full remote-management server (RDP/VNC/agent, wake-on-LAN). |
| **Nginx Proxy Manager** 🐳🌐⚡ | Reverse proxy + Let's Encrypt with a friendly UI. |
| **Traefik** 🐳 | Dynamic reverse proxy / load balancer for containers. |
| **Caddy** 🐳⚡ | Tiny reverse proxy with automatic HTTPS. |
| **Pi-hole** 🐳🌐⚡ | Network-wide ad/tracker blocking via DNS. |
| **AdGuard Home** 🐳🌐⚡ | DNS ad-blocking + DoH/DoT, nicer UI than Pi-hole. |
| **Unbound** 🐳⚡ | Recursive, validating DNS resolver (pairs with Pi-hole). |
| **Technitium DNS** 🐳🌐 | Full authoritative + recursive DNS server with UI. |

## 3. Files, sync & backup
| App | What it does |
|---|---|
| **Nextcloud** 🐳🌐 | Files, calendar, contacts, office — the self-hosted Google Drive. |
| **Seafile** 🐳🌐 | Fast file sync-and-share with versioning. |
| **Syncthing** 🐳🌐⚡ | P2P two-way sync (already in `../../sync/`). |
| **FileBrowser** 🐳🌐⚡ | Web file manager for a directory tree. |
| **Filestash** 🐳🌐 | Web front-end over SFTP/S3/etc. |
| **MinIO** 🐳🌐 | S3-compatible object storage you host yourself. |
| **Garage** 🐳⚡ | Lightweight S3-compatible store for small clusters. |
| **Kopia** 🐳🌐 | Fast, encrypted, deduplicated backups with a UI. |
| **Restic** ⚡ | Encrypted, deduplicated snapshot backups (CLI; pairs with `../../backup/`). |
| **BorgBackup** ⚡ | Deduplicating backup with append-only repos. |
| **Duplicati** 🐳🌐 | Scheduled encrypted backups to many destinations. |
| **UrBackup** 🐳🌐 | Client/server image + file backup for whole machines. |

## 4. Media servers & *arr stack
| App | What it does |
|---|---|
| **Jellyfin** 🐳🌐 | Free media server (movies/TV/music/live TV). |
| **Plex** 🐳🌐 | Polished media server with apps everywhere. |
| **Emby** 🐳🌐 | Media server, middle ground between the two. |
| **Navidrome** 🐳🌐⚡ | Subsonic-compatible music streaming server. |
| **Audiobookshelf** 🐳🌐 | Audiobook + podcast server with apps. |
| **Komga** 🐳🌐 | Comics/manga server (OPDS). |
| **Kavita** 🐳🌐 | Books/comics/manga reader server. |
| **Calibre-Web** 🐳🌐 | Web UI over a Calibre e-book library. |
| **Immich** 🐳🌐 | Self-hosted Google Photos with ML search + mobile apps. |
| **PhotoPrism** 🐳🌐 | AI-tagged personal photo library. |
| **Sonarr / Radarr / Lidarr / Readarr** 🐳🌐 | Automate TV / movies / music / books. |
| **Prowlarr** 🐳🌐 | Indexer manager feeding the *arr apps. |
| **Bazarr** 🐳🌐 | Subtitle automation for Sonarr/Radarr. |
| **Tdarr** 🐳🌐 | Distributed transcoding/health-checking of a library. |
| **Jellyseerr / Overseerr** 🐳🌐 | Request-and-discover front-end for media. |

## 5. Documents, notes & knowledge
| App | What it does |
|---|---|
| **Paperless-ngx** 🐳🌐 | Scan, OCR, tag and search all your documents. |
| **Trilium Next** 🐳🌐 | Hierarchical personal knowledge base/notes. |
| **Joplin Server** 🐳⚡ | Sync backend for the Joplin note apps. |
| **Memos** 🐳🌐⚡ | Lightweight, Twitter-style note/memo capture. |
| **Outline** 🐳🌐 | Team wiki/knowledge base with great editing. |
| **BookStack** 🐳🌐 | Simple, structured wiki (books → chapters → pages). |
| **Wiki.js** 🐳🌐 | Powerful multi-format wiki engine. |
| **HedgeDoc** 🐳🌐⚡ | Real-time collaborative Markdown. |
| **Docmost** 🐳🌐 | Notion-like collaborative docs/wiki. |
| **Stirling-PDF** 🐳🌐⚡ | 50+ local PDF operations in the browser. |

## 6. Productivity, calendar & mail
| App | What it does |
|---|---|
| **Vaultwarden** 🐳🌐⚡ | Bitwarden-compatible password manager server. |
| **Vikunja** 🐳🌐⚡ | To-do / task / project manager with lists & Gantt. |
| **Planka** 🐳🌐⚡ | Trello-style kanban boards. |
| **Focalboard** 🐳🌐 | Project/board management (Notion/Trello-like). |
| **Wekan** 🐳🌐 | Open-source kanban. |
| **Actual Budget** 🐳🌐⚡ | Fast local-first envelope budgeting. |
| **Firefly III** 🐳🌐 | Full personal-finance manager. |
| **Baikal** 🐳⚡ | Lightweight CalDAV/CardDAV (calendar + contacts) server. |
| **Radicale** 🐳⚡ | Tiny CalDAV/CardDAV server. |
| **Mailcow** 🐳🌐 | Full-featured mail server suite (Docker). |
| **Stalwart Mail** 🐳⚡ | Modern all-in-one mail server (JMAP/IMAP/SMTP). |
| **Cal.com** 🐳🌐 | Self-hosted scheduling (Calendly alternative). |
| **Docuseal** 🐳🌐 | Self-hosted document signing. |

## 7. Dev tools, Git & automation
| App | What it does |
|---|---|
| **Forgejo** 🐳🌐⚡ | Lightweight self-hosted Git forge (Gitea fork). |
| **Gitea** 🐳🌐⚡ | The other lightweight Git forge. |
| **GitLab CE** 🐳🌐 | Full DevOps platform (heavier). |
| **Woodpecker CI** 🐳⚡ | Simple container-native CI. |
| **Drone** 🐳 | Container CI/CD. |
| **n8n** 🐳🌐 | Visual workflow automation (Zapier alternative). |
| **Node-RED** 🐳🌐⚡ | Flow-based automation/IoT wiring. |
| **Activepieces** 🐳🌐 | Open-source no-code automation. |
| **Huginn** 🐳🌐 | Agents that watch and act on the web. |
| **code-server** 🐳🌐 | VS Code in the browser, hosted on your box. |
| **Coder** 🐳🌐 | Self-hosted remote dev environments. |
| **Portainer** 🐳🌐⚡ | Web UI to manage Docker/containers. |
| **Dockge** 🐳🌐⚡ | Compose-stack manager UI (great with this kit). |
| **Yacht** 🐳🌐⚡ | Container management UI. |
| **Watchtower** 🐳⚡ | Auto-update running containers. |
| **Diun** 🐳⚡ | Notify when container images have updates. |
| **PocketBase** 🐳⚡ | Single-file backend (DB + auth + API). |
| **Supabase** 🐳🌐 | Self-hosted Postgres backend + auth + storage. |
| **Appwrite** 🐳🌐 | Backend-as-a-service platform. |

## 8. Monitoring, alerting & ops
| App | What it does |
|---|---|
| **Uptime Kuma** 🐳🌐⚡ | Beautiful uptime/status monitoring + alerts. |
| **Gatus** 🐳⚡ | Declarative health-check dashboard. |
| **Beszel** 🐳🌐⚡ | Lightweight server resource monitoring. |
| **Netdata** 🐳🌐 | Real-time per-second metrics for hosts/containers. |
| **Glances** 🐳⚡ | Cross-platform system monitor (web/API). |
| **Grafana** 🐳🌐 | Dashboards/visualization for any data source. |
| **Prometheus** 🐳 | Metrics collection + alerting. |
| **InfluxDB** 🐳 | Time-series database for metrics. |
| **Loki** 🐳 | Log aggregation (pairs with Grafana). |
| **Dozzle** 🐳🌐⚡ | Live Docker log viewer in the browser. |
| **Scrutiny** 🐳🌐⚡ | S.M.A.R.T. disk-health dashboard. |
| **Healthchecks** 🐳🌐⚡ | Dead-man's-switch monitoring for cron jobs. |
| **ntfy** 🐳⚡ | Push notifications to your phone via HTTP. |
| **Gotify** 🐳🌐⚡ | Self-hosted push-notification server. |
| **Apprise** 🐳⚡ | One API to fan notifications out to 80+ services. |

## 9. Home automation & IoT
| App | What it does |
|---|---|
| **Home Assistant** 🐳🌐 | The hub for everything smart-home. |
| **ESPHome** 🐳🌐 | Firmware/automation for ESP devices. |
| **Zigbee2MQTT** 🐳🌐 | Bridge Zigbee devices to MQTT (no vendor cloud). |
| **Mosquitto** 🐳⚡ | MQTT broker. |
| **Frigate** 🐳🌐 | Local NVR with real-time object detection. |
| **Scrypted** 🐳🌐 | Smart-camera/HomeKit bridge platform. |
| **MotionEye** 🐳🌐 | Simple camera/NVR front-end. |
| **Double Take** 🐳🌐 | Face recognition glue for Frigate. |

## 10. Web, RSS, bookmarks & utilities
| App | What it does |
|---|---|
| **FreshRSS** 🐳🌐⚡ | Fast self-hosted RSS aggregator. |
| **Miniflux** 🐳⚡ | Minimalist RSS reader. |
| **Wallabag** 🐳🌐 | Read-it-later / article saver. |
| **Linkding** 🐳🌐⚡ | Minimal bookmark manager. |
| **LinkAce** 🐳🌐 | Bookmark archive with full-text. |
| **Shiori** 🐳🌐⚡ | Pocket-like bookmark + content saver. |
| **SearXNG** 🐳🌐⚡ | Private meta-search engine. |
| **Whoogle** 🐳🌐⚡ | Google results without the tracking. |
| **IT-Tools** 🐳🌐⚡ | 100+ developer utilities in one page. |
| **ConvertX** 🐳🌐 | Self-hosted file-format converter. |
| **Speedtest Tracker** 🐳🌐⚡ | Scheduled internet speed history. |
| **LibreSpeed** 🐳🌐⚡ | Self-hosted speed-test you control. |
| **Grocy** 🐳🌐 | "ERP for your fridge" — groceries/chores/stock. |
| **Mealie** 🐳🌐 | Recipe manager + meal planner. |
| **Tandoor** 🐳🌐 | Recipe management with smart shopping lists. |

## 11. Communication & collaboration
| App | What it does |
|---|---|
| **Matrix (Synapse)** 🐳 | Federated, encrypted chat server. |
| **Conduit** 🐳⚡ | Lightweight Matrix homeserver (Rust). |
| **Rocket.Chat** 🐳🌐 | Team chat (Slack alternative). |
| **Mattermost** 🐳🌐 | Team chat + collaboration. |
| **Jitsi Meet** 🐳🌐 | Self-hosted video conferencing. |
| **Mumble** 🐳⚡ | Low-latency voice chat server. |
| **Snikket** 🐳 | Easy, batteries-included XMPP chat. |

## 12. Databases & local AI
| App | What it does |
|---|---|
| **PostgreSQL / MariaDB / Redis** 🐳 | The usual backing stores many apps need. |
| **NocoDB** 🐳🌐 | Airtable-like UI over a SQL database. |
| **Baserow** 🐳🌐 | No-code database/spreadsheet. |
| **Directus** 🐳🌐 | Headless CMS/data platform over your DB. |
| **Ollama** 🐳⚡ | Run local LLMs (Llama, Mistral, etc.) with a simple API. |
| **Open WebUI** 🐳🌐 | ChatGPT-style UI in front of Ollama, fully local. |
| **LocalAI** 🐳 | OpenAI-compatible API served from local models. |
| **AnythingLLM** 🐳🌐 | Local RAG/chat over your own documents. |
| **LibreChat** 🐳🌐 | Multi-model chat UI you host yourself. |
| **Stable Diffusion WebUI / ComfyUI** 🐳🌐 | Local image generation. |
| **Whisper.cpp / faster-whisper** ⚡ | Local speech-to-text. |

---

### Adding one to your homelab
1. Add its service to `../../nas-docker/docker-compose.yml` (copy an existing
   block's `PUID`/`PGID`/`TZ`/volume pattern).
2. `docker compose up -d` on the NAS.
3. Reach it at `http://nas:<port>` over Tailscale (don't publish ports to the
   internet — the tailnet *is* your perimeter).
4. Add a tile in `../dashboard/config/services.yaml` so it shows up in the
   Operations Center.

> This is a living menu, not a to-do list. Every running service is something to
> update and back up — add deliberately.
