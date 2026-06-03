# Homelab Kit — Linux PC + UGREEN NAS over Tailscale

A small, self-contained set of scripts and configs to wire up a Linux PC and a
Docker-capable UGREEN NAS into one private network, with backups, file sync, and
self-hosted apps.

> **Reality check:** Claude (the assistant that generated this) runs in a cloud
> container and **cannot reach your machines**. Everything here is meant to be
> run by *you* on *your* PC and NAS. Tailscale links *your* devices to each
> other — not to any external service.

## What's in here

| Folder        | What it does                                                        |
|---------------|---------------------------------------------------------------------|
| `tailscale/`  | Get the PC + NAS onto your tailnet, enable Tailscale SSH, lock it down with ACLs |
| `backup/`     | Scheduled PC → NAS backup (rsync) with a systemd timer              |
| `sync/`       | Two-way file sync between PC and NAS (Syncthing)                    |
| `nas-docker/` | Docker Compose stack to run on the NAS (Syncthing + room to grow)   |

## Recommended order

1. **`tailscale/`** — do this first. Nothing else works remotely until both
   machines are on the tailnet and you can SSH between them.
2. **`nas-docker/`** — bring up the Docker stack on the NAS (Syncthing lives here).
3. **`sync/`** — pair the PC with the NAS Syncthing instance.
4. **`backup/`** — schedule backups once you can reach the NAS over SSH.

## Conventions used everywhere

- The NAS is referred to by its **MagicDNS name** `nas` (Tailscale gives every
  device a stable name — find/set yours in the Tailscale admin console).
  Replace `nas` with your actual device name if different.
- The NAS login user is `NAS_USER` — replace with your real UGOS user.
- Nothing here hard-codes secrets. Per-machine values go in `.env` files you
  create from the provided `.env.example` templates (and which are gitignored).

## Security notes

- Tailscale SSH means you don't expose SSH to the public internet — only devices
  on *your* tailnet can connect, and you authenticate with your Tailscale
  identity. Keep your Tailscale account locked down (strong password + 2FA).
- The ACL in `tailscale/acl.example.json` is deliberately restrictive. Loosen it
  deliberately, not by default.
- Don't commit real `.env` files. The `.gitignore` here already excludes them.
