# Operations Center — your homelab's single pane of glass

The rest of the kit gives you the *plumbing* (Tailscale, backups, sync, remote
desktop). The **Operations Center** is the *cockpit*: one self-hosted dashboard
on the NAS that links to and monitors everything, plus a big catalog of
**100+ all-local options** you can bolt on whenever you want.

> **Reality check:** Claude (the assistant that generated this) runs in a cloud
> container and **cannot reach your machines**. Everything here runs on *your*
> NAS/PC and is reached over *your* tailnet. "All local" is the whole point —
> nothing here phones home or depends on a third-party cloud.

## What's in here

| Folder        | What it does                                                          |
|---------------|----------------------------------------------------------------------|
| `dashboard/`  | The control center itself — a [Homepage](https://gethomepage.dev) stack for the NAS, pre-wired to the homelab, bound to the tailnet |
| `catalog/`    | The "100+ options for everything" — a curated, categorized menu of self-hostable apps + every remote-access method, all local |
| `stacks/`     | Copy-paste Docker Compose for the 10 most useful apps, ports pre-matched to the dashboard tiles |

## The 60-second version

1. Bring up the dashboard on the NAS:
   ```bash
   cd homelab/operations-center/dashboard
   cp .env.example .env && $EDITOR .env
   docker compose up -d
   ```
2. Open it from any tailnet device: **http://nas:3000**.
3. Browse `catalog/` and pick what to self-host next. Each entry is a real,
   actively-maintained project that runs locally and plays nicely behind
   Tailscale. Add it to your NAS Docker stack, then drop a tile for it in
   `dashboard/config/services.yaml`.

## How it ties the kit together

```
                ┌─────────────────────────────┐
   any device → │   Operations Center (NAS)   │ ← http://nas:3000
   on tailnet   │   Homepage dashboard        │
                └──────────────┬──────────────┘
                               │ links + live widgets
        ┌──────────────┬───────┴───────┬──────────────┐
        ▼              ▼               ▼              ▼
   Tailscale       Syncthing       RustDesk      everything you
   (../tailscale)  (../sync)       (../remote-    add from catalog/
                                    desktop)
```

## Design rules (same as the rest of the kit)

- **All local.** Every option in `catalog/` is self-hostable and runs on your own
  hardware. No SaaS dependencies.
- **Tailnet-only by default.** The dashboard binds to the NAS and is reached at
  `nas:3000` over Tailscale — not exposed to the internet. Gate it further with
  the ACL patterns in `../remote-desktop/tailscale-acl.snippet.json`.
- **No committed secrets.** Per-machine values live in gitignored `.env` files
  from the `.env.example` templates.
- **Pick deliberately.** The catalog is a menu, not a shopping list — adding 100
  services means 100 things to update. Start with the dashboard + what you'll
  actually use.
