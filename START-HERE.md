# 🟢 START HERE — run everything on your own PC (no coding needed)

This repo contains **Alpha Terminal** (in the [`crypto-terminal/`](crypto-terminal/)
folder): a live crypto + stock momentum / breakout dashboard with phone alerts
and an optional AI briefing powered by **your** RTX 5090. This page gets it
running on your computer in a few clicks. You do **not** need to know how to code.

> ⚠️ **Not financial advice.** It measures real market structure and ranks setups —
> it does not predict the future. Only risk what you can afford to lose.

---

## ✅ What you get, in one place

One window/app that shows, and keeps updating by itself:

- 🚀 **About to explode** — coins coiling up before a breakout
- 📈 **Buy now** — coins with confirmed momentum
- 📊 **Stocks moving** — the same engine on 55 live US stocks
- 🔔 **Phone alerts** — get a notification when something fires
- 🧠 **AI desk briefing** *(optional)* — written locally on your 5090

It runs **non-stop**: the launcher automatically restarts it if it ever stops.

---

## 🪟 If you're on Windows (your 5090 PC) — the easy way

1. **Install Node.js once.** Go to <https://nodejs.org>, click the big green
   **LTS** button, run the installer, and keep clicking *Next / Install*.
2. Open the **`crypto-terminal`** folder in this project.
3. **Double-click `start-windows.cmd`.**
4. A black window opens and prints two web addresses. Leave that window **open**.
5. On the same PC, open a browser to **<http://localhost:8787>**. That's your dashboard. 🎉

To **stop** it, close that black window (or press `Ctrl+C` in it).

## 🍎🐧 If you're on Mac or Linux

Open a terminal in the `crypto-terminal` folder and run:

```bash
./start-mac-linux.sh
```

(Make sure Node.js from <https://nodejs.org> is installed first.) Then open
<http://localhost:8787>.

> Prefer typing commands? From inside `crypto-terminal/` you can also just run
> **`npm run go`** — it does the exact same thing on every operating system.

---

## 📱 Put it on your phone (same Wi-Fi)

The black launcher window prints a line like `On your PHONE: http://192.168.x.x:8787`.

1. Make sure your phone is on the **same Wi-Fi** as the PC.
2. Open that address in your phone's browser.
3. Tap **Share → "Add to Home Screen."** Now it's a real app icon with
   background **push alerts** (tap **🔔 Alerts** inside the app once to allow them).

---

## 🧠 Turn on the 5090 AI briefing (optional)

The market data comes from the internet — your 5090's job is to run a local AI
that writes a short plain-English briefing over the signals. It's **off** until
you turn it on, and it never leaves your PC.

1. Install **Ollama** from <https://ollama.com> (one normal installer).
2. Open a terminal once and run: `ollama pull llama3`
3. Turn it on for the launcher:
   - **Windows:** edit `crypto-terminal/start-windows.cmd` and delete the word
     `REM` in front of the two `set ALPHA_AI...` lines, then double-click it again.
   - **Mac/Linux:** edit `start-mac-linux.sh` and remove the `#` in front of the
     two `export ALPHA_AI...` lines, then run it again.

The dashboard will now show a **🧠 AI Desk Briefing** panel.

---

## 🖥️ Always-on / NAS / home-server option

If you want it running 24/7 without keeping a window open, use Docker (it also
wires the 5090 into the AI automatically):

```bash
cd crypto-terminal
docker compose up -d        # runs forever, restarts on reboot
# then open http://localhost:8787
```

See [`crypto-terminal/README.md`](crypto-terminal/README.md) for every option
and setting.

---

## 🙋 Honest note about "one fully-agentic AI wired into all my repos"

This project is the **command center for the crypto/stock side** — one app, one
address, running non-stop on your hardware. A single program that autonomously
operates across *every* repository you own is a much bigger, separate system and
isn't something this repo does today. If that's the goal, tell me and we can plan
it step by step. For now, **everything in `crypto-terminal/` works locally on your
PC with the steps above.**

## 🆘 If something doesn't work

- **"node is not recognized" / "command not found":** Node.js isn't installed
  yet — do step 1 above, then try again.
- **The page won't open:** make sure the black launcher window is still open.
- **Phone can't reach it:** phone and PC must be on the **same Wi-Fi**; some
  networks block this — try your home Wi-Fi.
- **No signals showing:** it needs internet to fetch live prices; when the market
  is calm the "About to explode" panel can be empty on purpose.
