# Remote desktop: control your PC's screen over Tailscale

SSH (`tailscale/setup.md`) gets you a *terminal* on your machines. This adds the
*graphical* layer — see and control the actual desktop of your Linux PC (and,
where it makes sense, the NAS) from a laptop, phone, or tablet, all over your
tailnet. No ports exposed to the internet.

> **Reality check:** Claude (the assistant that generated this) runs in a cloud
> container and **cannot reach your machines or their screens**. Everything here
> is run by *you* on *your* devices. Tailscale carries the pixels privately
> between *your* own machines — nothing is published anywhere.

## The security model (read this first)

Every method below is told to **bind only to the Tailscale interface** (the
`100.x.y.z` address), never to `0.0.0.0`. That single rule is what makes this
safe:

- The remote-desktop port is reachable **only** from devices on your tailnet.
- Tailscale (WireGuard) already encrypts the whole stream end-to-end, so even
  plain VNC — historically weak — is fine *inside the tunnel*.
- You still set a password on the server as a second factor, and you lock the
  ports down further with the ACL snippet in `tailscale-acl.snippet.json`.

If you ever bind one of these to all interfaces and forward a port, you've
thrown that away. Don't.

## Which method should I pick?

| Your situation | Use | Folder |
|---|---|---|
| GNOME or KDE Plasma desktop (Wayland *or* X11) | Built-in **RDP** (gnome-remote-desktop / krfb) | `rdp/` |
| sway / Hyprland / other wlroots Wayland compositor | **wayvnc** | `vnc/` |
| Plain X11 desktop (XFCE, MATE, i3, …) | **x11vnc** | `vnc/` |
| Phone-friendly, cross-platform, unattended access, NAT-busting, fully self-hosted | **RustDesk** (server on the NAS) | `rustdesk/` |
| Headless NAS — you only ever need a shell | You don't need this; use Tailscale SSH | `../tailscale/` |

Rules of thumb:

- **On a modern GNOME/KDE box, prefer RDP.** It's built into the desktop, it
  handles Wayland correctly (VNC on GNOME Wayland does *not*), the clients are
  everywhere (Windows' built-in `mstsc`, `freerdp`, Remmina, mobile apps), and
  it's the least to install.
- **Reach for VNC** when you're on a non-GNOME/KDE setup. wayvnc for wlroots
  Wayland, x11vnc for plain X11.
- **Reach for RustDesk** when you want one tool that works from a phone, for
  unattended machines, and across an OS mix — at the cost of running a small
  relay server (which you host on the NAS, so it stays private).

You can mix and match: RDP to the PC, RustDesk for the phone. Pick per machine.

## Recommended order

1. **`tailscale/`** (sibling folder) must be done first — both machines on the
   tailnet, MagicDNS on, `ping pc` / `ping nas` work.
2. Pick a method above and follow that folder's README.
3. Apply `tailscale-acl.snippet.json` to your Access Controls to restrict which
   devices may open remote-desktop sessions.

## Conventions used here

- The Linux PC is referred to by its MagicDNS name **`pc`**, the NAS as **`nas`**
  — same as the rest of the kit. Replace with your real device names.
- Per-machine secrets (RustDesk keys, etc.) go in gitignored `.env` files made
  from the `.env.example` templates. Nothing here hard-codes a password.
- Standard ports referenced throughout: RDP `3389`, VNC `5900`, RustDesk
  `21115–21119`.
