# RDP over Tailscale

RDP is the best fit for **GNOME** and **KDE Plasma** desktops: both ship a
built-in RDP server that handles Wayland correctly (where VNC fails), and RDP
clients are everywhere — Windows' built-in `mstsc`, `freerdp`, Remmina, and
mobile apps. Reached only over your tailnet; no public exposure.

> Not on GNOME/KDE? If you're on sway/Hyprland or plain X11, `../vnc/` is the
> simpler path. If you want phone-first / unattended / cross-OS, see
> `../rustdesk/`.

There are two flavors below. Pick the one matching your desktop.

---

## A. GNOME (built-in, recommended on GNOME)

GNOME 42+ has remote desktop over RDP built into Settings. No extra install.

1. **Settings → System → Remote Desktop** (older: **Sharing → Remote Desktop**).
2. Enable **Remote Desktop** and **Remote Control**.
3. Set a **username** and **password** under "Authentication".
4. For unattended access (log in when no one is at the keyboard), also enable
   **Remote Login** (this is `gnome-remote-desktop` in headless/system mode and
   may require GDM 44+).

GNOME's RDP server already listens on all interfaces on port **3389**; Tailscale
+ the ACL snippet are what keep it private. To be stricter, you can bind it to
the tailnet only:

```bash
# Show current setting, then pin it to your Tailscale IP:
gsettings get  org.gnome.desktop.remote-desktop.rdp '' 2>/dev/null || true
# (Binding controls vary by GNOME version; if there's no bind-address key,
#  rely on the Tailscale ACL in ../tailscale-acl.snippet.json to gate port 3389.)
```

Connect from another tailnet device:

```bash
xfreerdp /v:pc /u:YOUR_USER /p:'YOUR_PASS' /dynamic-resolution
# or Windows:  mstsc /v:pc
```

---

## B. KDE Plasma 6 (built-in)

Plasma 6 ships an RDP server too:

1. **System Settings → Remote Desktop**.
2. Enable the server, add a username/password, note the port (**3389**).
3. Connect exactly as above with `xfreerdp /v:pc ...`.

---

## C. xrdp (any Linux desktop, incl. XFCE/MATE/Cinnamon)

When the desktop has no native RDP, `xrdp` provides one. It spins up its own
session, so it also works on otherwise-headless boxes.

### Install

```bash
# Debian/Ubuntu
sudo apt install xrdp
# Fedora
sudo dnf install xrdp
# Arch (AUR)
yay -S xrdp
```

### Bind to the tailnet only (important)

By default xrdp listens on `0.0.0.0:3389`. Pin it to your Tailscale IP so it's
unreachable except over the tailnet. Edit `/etc/xrdp/xrdp.ini`:

```ini
[Globals]
; was: address=0.0.0.0
address=100.x.y.z        ; <- your `tailscale ip -4`
port=3389
```

> Tip: the tailnet IP is stable per machine, but if you reinstall Tailscale it
> can change. If you'd rather not hard-code it, leave `address=0.0.0.0` and let
> the Tailscale ACL (`../tailscale-acl.snippet.json`) be the gate — that already
> blocks every non-tailnet source.

Then:

```bash
sudo systemctl enable --now xrdp
sudo systemctl restart xrdp
sudo systemctl status xrdp
```

If you run a firewall, allow 3389 **only** on the Tailscale interface:

```bash
# ufw example — restrict to the tailscale0 interface
sudo ufw allow in on tailscale0 to any port 3389 proto tcp
```

### Connect

```bash
xfreerdp /v:pc /u:YOUR_USER /p:'YOUR_PASS' /dynamic-resolution /sound
# Windows:  mstsc /v:pc
# Phone:    Microsoft Remote Desktop / any RDP app, host "pc", with Tailscale on
```

### xrdp gotchas

- **"Login failed" with the right password** → xrdp couldn't start your session.
  Make sure a desktop is installed and, for XFCE, that `~/.xsession` contains
  `startxfce4`. Logs: `sudo journalctl -u xrdp -f` and `~/.xorgxrdp.*.log`.
- **Already logged in at the physical screen** → some desktops refuse a second
  concurrent session. Log out locally, or use xorgxrdp's session sharing.
- **Black screen on Ubuntu** → the `xrdp-sesman` polkit/color-manager prompt;
  the well-known fix is a polkit rule allowing `colord` for the xrdp user.

## Security recap

RDP transports its own TLS, but the real guarantee here is the same as the rest
of the kit: the port is reachable only from your tailnet, gated by the ACL. Use a
strong password, and don't port-forward 3389 to the internet.
