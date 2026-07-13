# Remote-access options — every way to reach your machines, all local

The `../../remote-desktop/` folder ships the three you'll most likely use (VNC,
RDP, RustDesk). This is the **full menu** — graphical, terminal, file, and
network-level remote access — so you can pick the right tool per job. Everything
here is self-hostable and runs over *your* tailnet; nothing depends on a vendor
cloud relay.

Legend: 🖥️ graphical desktop · ⌨️ terminal/shell · 📁 files · 🌐 network/VPN ·
📱 good mobile client · 🔓 unattended-capable.

## Graphical desktop
| Option | Type | Notes |
|---|---|---|
| **RDP — GNOME/KDE built-in** | 🖥️📱🔓 | Native on modern desktops, correct on Wayland. See `../../remote-desktop/rdp/`. |
| **xrdp** | 🖥️🔓 | RDP for any Linux desktop; spins its own session. |
| **wayvnc** | 🖥️ | VNC for wlroots Wayland (sway/Hyprland). |
| **x11vnc** | 🖥️ | VNC mirroring an existing X11 session. |
| **TigerVNC / TurboVNC** | 🖥️🔓 | Full VNC servers with virtual desktops. |
| **RustDesk (self-hosted)** | 🖥️📱🔓 | Cross-platform, phone-friendly. See `../../remote-desktop/rustdesk/`. |
| **Apache Guacamole** | 🖥️📁🌐 | Clientless RDP/VNC/SSH **in the browser** — one tab for everything. |
| **MeshCentral** | 🖥️⌨️🔓 | Full fleet management: remote desktop, terminal, files, wake-on-LAN. |
| **NoMachine** | 🖥️📱🔓 | Very fast proprietary remote desktop (free for personal use). |
| **Sunshine + Moonlight** | 🖥️📱 | Low-latency game/desktop streaming (GPU-accelerated). |
| **Kasm Workspaces** | 🖥️🌐 | Streamed containerized desktops/apps in the browser. |

## Terminal / shell
| Option | Type | Notes |
|---|---|---|
| **Tailscale SSH** | ⌨️🔓 | No keys to manage, identity-based. Already in `../../tailscale/`. |
| **OpenSSH** | ⌨️📁🔓 | The classic; tunnel it over the tailnet, never public. |
| **Mosh** | ⌨️📱 | Roaming, latency-tolerant shell — great on cellular. |
| **Eternal Terminal (ET)** | ⌨️ | Reconnecting remote shell. |
| **ttyd** | ⌨️🌐 | Share a terminal over the web (put behind the tailnet). |
| **Wetty** | ⌨️🌐 | SSH/terminal in the browser. |
| **Cockpit** | ⌨️🌐🔓 | Web console for managing a Linux server (services, logs, terminal). |
| **tmux / GNU Screen** | ⌨️ | Persistent sessions that survive disconnects. |

## File access
| Option | Type | Notes |
|---|---|---|
| **rsync over SSH** | 📁🔓 | The backup path in `../../backup/`. |
| **SFTP / SCP** | 📁 | Built into SSH; works anywhere SSH does. |
| **Syncthing** | 📁🔓 | Live two-way sync (`../../sync/`). |
| **Samba / NFS** | 📁 | Mount NAS shares over the tailnet as local drives. |
| **WebDAV** (Nextcloud/rclone) | 📁🌐 | Mountable file access over HTTP. |
| **FileBrowser / Filestash** | 📁🌐 | Web file managers (see app catalog). |

## Network-level (be on the LAN from anywhere)
| Option | Type | Notes |
|---|---|---|
| **Tailscale** | 🌐📱🔓 | The mesh this kit uses. |
| **Headscale** | 🌐🔓 | Run your **own** Tailscale control server. |
| **NetBird** | 🌐📱 | WireGuard mesh + self-hosted control plane. |
| **WireGuard** (wg-easy) | 🌐📱 | Plain WireGuard with a web UI. |
| **ZeroTier** | 🌐📱 | Alternative overlay network. |
| **OpenVPN** | 🌐📱 | The old reliable, if you must. |
| **Tailscale subnet router** | 🌐🔓 | Expose the whole LAN to the tailnet via one node. |
| **Tailscale Funnel** | 🌐 | *Optional* public ingress — opt-in only, off by default. |

## Power & presence (so the machine is actually up to control)
| Option | Type | Notes |
|---|---|---|
| **Wake-on-LAN** | 🔓 | Wake a sleeping PC; trigger from a NAS script on the tailnet. |
| **IPMI / iDRAC / iLO** | 🖥️🔓 | Out-of-band server management (if your hardware has it). |
| **PiKVM / TinyPilot** | 🖥️🔓 | KVM-over-IP: BIOS-level control of any machine. |
| **Smart plug + Home Assistant** | 🔓 | Hard power-cycle a wedged box remotely. |

---

### Picking one
- **Daily driver, GNOME/KDE box →** RDP.
- **Phone, mixed OS, unattended →** RustDesk.
- **"One browser tab for all my machines" →** Guacamole or MeshCentral.
- **Just need a shell →** Tailscale SSH (add Mosh for cellular).
- **BIOS/boot-level rescue →** PiKVM.

All of them ride the tailnet — the golden rule stays: **bind to Tailscale, never
forward a port to the internet.**
