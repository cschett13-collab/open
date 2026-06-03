# Backups: PC → NAS over Tailscale

Incremental, mirror-style backups using `rsync` over Tailscale SSH. No ports
exposed to the internet; transfers only happen across your tailnet.

## Setup

1. Make sure `tailscale/setup.md` is done and `ssh NAS_USER@nas` works.
2. Configure:
   ```bash
   cd homelab/backup
   cp backup.env.example backup.env
   $EDITOR backup.env            # set NAS_HOST, NAS_USER, NAS_DEST_PATH, SOURCES
   chmod +x backup-to-nas.sh
   ```
3. Dry-run first to see what *would* happen:
   ```bash
   DRY_RUN=1 ./backup-to-nas.sh
   ```
4. Real run:
   ```bash
   ./backup-to-nas.sh
   ```
5. Schedule it (daily at 02:00) — see header of `backup-to-nas.service`.

## Important: `--delete` is a mirror

This script mirrors, so files you delete on the PC get deleted on the NAS on the
next run. That's usually what you want for a backup *mirror*, but it is **not
versioned history** — if you delete something and a backup runs, it's gone from
the NAS too.

If you want point-in-time snapshots (recover "yesterday's version"), graduate to
**restic** or **borg** instead of plain rsync. Quick restic sketch:

```bash
# one-time
export RESTIC_REPOSITORY="sftp:NAS_USER@nas:/volume1/backups/restic"
export RESTIC_PASSWORD="choose-a-strong-passphrase"   # store securely!
restic init

# each run (dedup + encrypted + versioned)
restic backup /home/me/Documents /home/me/Projects
restic snapshots          # list versions
restic restore latest --target /tmp/restore
```

Ask and I can convert the script + timer to a restic-based version with
retention pruning (`restic forget --keep-daily 7 --keep-weekly 4 ...`).
