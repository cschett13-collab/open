# File sync: PC ⇄ NAS with Syncthing

Backups (rsync) are one-way and scheduled. **Syncthing** is for *live two-way
sync* — edit a file on the PC, it appears on the NAS (and your phone) within
seconds. Use both: Syncthing for working files, rsync/restic for backup history.

## Prereqs

- NAS Syncthing is running (see `../nas-docker/`), reachable at `http://nas:8384`.
- Both machines are on the tailnet.

## 1. Install Syncthing on the Linux PC

```bash
# Debian/Ubuntu
sudo apt install syncthing
# Fedora
sudo dnf install syncthing

# Run it for your user and have it start on login:
systemctl --user enable --now syncthing.service
```

Open the PC web UI: `http://127.0.0.1:8384`.

## 2. Pair the two devices

1. On the **NAS** UI (`http://nas:8384`): **Actions → Show ID**, copy the
   device ID.
2. On the **PC** UI: **Add Remote Device**, paste the NAS device ID, name it
   `nas`. The NAS will show a prompt to accept the PC back — accept it.
3. Because both are on Tailscale, they connect directly and privately. You can
   even paste the NAS's `nas:22000` as a static address on the PC device config
   if discovery is slow.

## 3. Share a folder

1. On the PC: **Add Folder**, pick the local path (e.g. `~/Sync`), give it a
   **Folder ID** like `main-sync`.
2. Under **Sharing**, tick the `nas` device. Save.
3. On the NAS UI, accept the shared folder and point it at a path under your
   `DATA_ROOT` (e.g. `/data/main-sync`).
4. Done — files now sync both ways automatically.

## Tips

- Set the folder type to **Send & Receive** on both for true two-way sync.
- Use **Ignore Patterns** (e.g. `node_modules`, `*.tmp`) to keep junk out.
- Syncthing keeps optional file versioning per-folder (Settings → File
  Versioning) — handy as a lightweight "oops" safety net.
