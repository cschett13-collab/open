# VNC over Tailscale (wayvnc / x11vnc)

Mirror your *existing* desktop session to another device — what you see on the
PC's monitor is what the remote sees. Good for non-GNOME/KDE setups. The server
binds to the Tailscale IP only, so the screen is reachable solely from your
tailnet.

> **GNOME or KDE?** Don't use this — use `../rdp/` instead. VNC on GNOME Wayland
> in particular won't capture the screen. RDP is built into those desktops and
> works correctly on Wayland.

## Which server?

- **Wayland on wlroots** (sway, Hyprland, river, …) → **wayvnc**.
- **X11** (XFCE, MATE, i3, older setups) → **x11vnc**.

Check what you're on:

```bash
echo "$XDG_SESSION_TYPE"     # wayland or x11
echo "$XDG_CURRENT_DESKTOP"  # sway, Hyprland, XFCE, ...
```

## 1. Install

```bash
# Debian/Ubuntu
sudo apt install wayvnc      # for wlroots Wayland
sudo apt install x11vnc      # for X11

# Fedora
sudo dnf install wayvnc
sudo dnf install x11vnc

# Arch
sudo pacman -S wayvnc
sudo pacman -S x11vnc
```

## 2. Set a VNC password (second factor behind Tailscale)

x11vnc:

```bash
mkdir -p ~/.config/homelab
x11vnc -storepasswd ~/.config/homelab/vncpasswd     # prompts, writes the file
```

wayvnc reads credentials from `~/.config/wayvnc/config`. Minimal example:

```ini
# ~/.config/wayvnc/config
enable_auth=true
username=me
password=choose-a-strong-one
# Optional TLS on top of Tailscale (belt and suspenders):
# private_key_file=/home/me/.config/wayvnc/tls_key.pem
# certificate_file=/home/me/.config/wayvnc/tls_cert.pem
```

## 3. Start it bound to the tailnet only

Use the helper, which looks up your Tailscale IP and starts the right server
listening on *that address only*:

```bash
chmod +x start-vnc.sh
./start-vnc.sh            # auto-detects wayland vs x11
```

What it does under the hood (so you can run it by hand if you prefer):

```bash
TS_IP=$(tailscale ip -4)

# X11:
x11vnc -rfbauth ~/.config/homelab/vncpasswd \
       -listen "$TS_IP" -rfbport 5900 \
       -display :0 -forever -shared -noxdamage

# wlroots Wayland:
wayvnc "$TS_IP" 5900
```

The `-listen "$TS_IP"` / address argument is the important part: it refuses
connections from anything that isn't coming in over Tailscale.

## 4. Connect from another device

From any device on the tailnet, point a VNC viewer at **`pc:5900`** (or the
PC's `100.x.y.z`):

```bash
# Linux / macOS clients
vncviewer pc:5900           # TigerVNC
remmina -c vnc://pc:5900    # Remmina
```

On a phone, use any VNC app (e.g. RealVNC Viewer, bVNC) with host `pc`,
port `5900`, and the password you set. The phone must have Tailscale running and
be logged into the same tailnet.

## 5. Autostart on login (optional)

Install the matching systemd **user** unit so the server comes up with your
session:

```bash
mkdir -p ~/.config/systemd/user
cp wayvnc.service  ~/.config/systemd/user/   # Wayland
#   …or…
cp x11vnc.service  ~/.config/systemd/user/   # X11

systemctl --user daemon-reload
systemctl --user enable --now wayvnc.service   # or x11vnc.service
systemctl --user status wayvnc.service
```

Both units call `start-vnc.sh`, so they inherit the bind-to-tailnet behavior.
Edit the `ExecStart` path in the unit to match where you cloned this repo.

## Troubleshooting

- **`tailscale ip -4` prints nothing** → Tailscale isn't up. `sudo tailscale up`.
- **Connection refused from another device** → the server bound before Tailscale
  had an IP, or you're on X11 but ran wayvnc (or vice-versa). Restart the helper
  *after* `tailscale status` shows you connected.
- **Black screen on Wayland** → you're not on a wlroots compositor (likely GNOME
  or KDE). Switch to `../rdp/`.
- **`-display :0` wrong** → find your X display with `echo $DISPLAY` while logged
  into the desktop, and adjust.
- **Laggy over cellular** → drop color depth / enable compression in the viewer;
  Tailscale will still try a direct path, but a relayed connection adds latency.
