# Tailscale: PC + NAS + SSH

Goal: both machines on your tailnet, reachable by stable name, with SSH that
never touches the public internet.

## 1. Install Tailscale on the Linux PC

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Bring it up **with Tailscale SSH enabled**:

```bash
sudo tailscale up --ssh
```

Authenticate in the browser link it prints. Confirm:

```bash
tailscale status
tailscale ip -4        # your PC's tailnet IP (100.x.y.z)
```

## 2. Install Tailscale on the UGREEN NAS

UGOS ships a Tailscale app in some firmware versions; if yours has it, install
from the App Center and log in. If not, run it as a Docker container using the
NAS Docker stack — see `../nas-docker/docker-compose.yml` (the `tailscale`
service). Either way, after it's up:

- In the **Tailscale admin console** (https://login.tailscale.com/admin/machines)
  you'll see the NAS appear.
- Rename it to `nas` so MagicDNS gives you a clean `nas` hostname.
- (Optional) Click the NAS device → **Disable key expiry** so it doesn't drop
  off the tailnet every ~6 months.

## 3. Enable MagicDNS

In the admin console → **DNS** → enable **MagicDNS**. Now from the PC you can do:

```bash
ssh NAS_USER@nas         # works from anywhere, no port forwarding
ping nas
```

## 4. Lock it down with an ACL

The default tailnet policy lets every device talk to every device. Tighten it
with `acl.example.json` (paste into admin console → **Access Controls**). It:

- lets your user reach all your own devices,
- restricts who can use Tailscale SSH,
- is a safe starting point you can expand.

## 5. (Optional) Reach the NAS web UI by name

Once on the tailnet, the UGOS web UI is just `http://nas:9999` (or whatever port
UGOS uses) from any of your devices — no exposing it to the internet.

## Troubleshooting

- `tailscale status` shows `Tailscale SSH enabled` on the PC? If not, re-run
  `sudo tailscale up --ssh`.
- Can't resolve `nas`? MagicDNS off, or the device isn't named `nas`.
- SSH refused? Tailscale SSH only works **to** a node that ran `tailscale up
  --ssh`. The *destination* must have it enabled. Enable it on the NAS node too
  if you want to SSH *into* the NAS via Tailscale.
