# Catalog — 100+ all-local options

A curated menu of things you can self-host and reach over your tailnet. Two
lists:

| File | What's in it |
|---|---|
| [`self-hosted-apps.md`](self-hosted-apps.md) | 100+ self-hostable apps across 12 categories — dashboards, files, media, docs, monitoring, home automation, local AI, and more. |
| [`remote-access.md`](remote-access.md) | Every way to reach your machines — graphical, terminal, file, network-level, and power/presence. |

## How to use it

1. Skim for something you want. Every entry is a real, actively-maintained,
   Docker-friendly project that runs **locally**.
2. Add it to your NAS Docker stack (`../../nas-docker/`).
3. Reach it at `http://nas:<port>` over Tailscale — **never** forward ports to
   the internet; the tailnet is your perimeter.
4. Add a tile in `../dashboard/config/services.yaml` so it appears in the
   Operations Center.

## Principles

- **All local.** No SaaS, no vendor cloud, no phone-home. Your data stays on your
  hardware.
- **Tailnet-only by default.** Privacy and security come from Tailscale, not from
  exposing services publicly.
- **Curated, not exhaustive.** For the full universe see
  [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted);
  this list is the homelab-relevant, NAS-friendly slice.
- **Add deliberately.** Each service is something to update, monitor, and back
  up. A leaner stack you actually maintain beats 100 half-configured apps.
