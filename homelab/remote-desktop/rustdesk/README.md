# RustDesk: self-hosted remote desktop, server on the NAS

[RustDesk](https://rustdesk.com) is an open-source, TeamViewer-style remote
desktop. Unlike VNC/RDP it gives you one app that works **across OSes**, from a
**phone**, and for **unattended** machines — with a tiny self-hosted server so no
third party is in the loop. We run that server on the NAS, reachable over your
tailnet.

Pick this when: you want phone-first control, a single cross-platform tool, or
unattended access to machines that aren't always at a login screen.

## How the pieces fit

- **Server (on the NAS):** `hbbs` (ID/rendezvous) + `hbbr` (relay). Provided as a
  Docker Compose stack here.
- **Clients (PC, laptop, phone):** the RustDesk app, pointed at *your* server
  instead of the public one.
- **Tailscale:** carries everything privately. On the tailnet, clients normally
  connect peer-to-peer; the relay is a fallback.

## 1. Bring up the server on the NAS

```bash
# On the NAS (over Tailscale SSH):
mkdir -p /volume1/docker/rustdesk
cd /volume1/docker/rustdesk
# copy this folder's docker-compose.yml and .env.example here, then:
cp .env.example .env
$EDITOR .env                # set TZ, DATA_ROOT, RELAY_HOST=nas
docker compose up -d
docker compose ps
```

First start generates the server keypair. Grab the **public key** — clients need
it:

```bash
cat /volume1/docker/rustdesk/id_ed25519.pub
```

## 2. Point each client at your server

In the RustDesk client: **☰ menu → Settings → Network → ID/Relay Server**, and set:

| Field        | Value                                        |
|--------------|----------------------------------------------|
| ID Server    | `nas` (MagicDNS) or the NAS `100.x.y.z`      |
| Relay Server | `nas`                                        |
| API Server   | *(leave blank)*                              |
| Key          | the contents of `id_ed25519.pub` from step 1 |

Do this on every device (the PC you want to control *and* the laptop/phone you
control it from). Each must have Tailscale up and be on your tailnet.

## 3. Connect

- Each machine shows a numeric **ID**. On the controlling device, type the target
  machine's ID and connect.
- For **unattended access**, set a permanent password on the target machine:
  **Settings → Security → Unattended Access / Permanent password**.

## Why host the server when Tailscale already connects everything?

Tailscale gives you the private *network path*; RustDesk gives you the
*screen-sharing protocol, account-free pairing, and clients (incl. mobile)*. The
self-hosted `hbbs`/`hbbr` means device discovery and any relayed traffic stay on
**your** infrastructure instead of RustDesk's public servers — and because it all
rides the tailnet, it's never exposed to the internet.

## Security notes

- **Do not port-forward** 21115–21119 to the internet. They're meant to be
  reached only over the tailnet. The ACL snippet
  (`../tailscale-acl.snippet.json`) gates them further.
- Set a strong unattended password on any machine left logged in.
- Keep `id_ed25519` (the **private** key, next to the `.pub`) on the NAS only —
  it's gitignored here as part of `DATA_ROOT`, never commit it.

## Troubleshooting

- **Clients show "Not Ready" / can't register** → wrong ID Server, or the NAS
  isn't reachable. From a client: `ping nas` and `nc -vz nas 21116`.
- **Connects but no video, high latency** → it fell back to relay. Confirm
  `RELAY_HOST=nas` resolves from clients; on the tailnet a direct path should
  form once both peers are connected (`tailscale status` shows `direct`).
- **Key mismatch** → you regenerated the server key (deleted `DATA_ROOT`); paste
  the new `id_ed25519.pub` into every client again.
