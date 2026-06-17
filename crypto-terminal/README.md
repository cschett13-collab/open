# ▲ ALPHA TERMINAL

> Your quant desk in the terminal. A **live, zero-latency crypto momentum & breakout scanner** that tells you what's strong **right now** and what's **coiling to explode** — built from real price/volume structure, not vibes.

It runs entirely in your terminal, repaints continuously, and uses **zero npm dependencies** (pure Node + the OKX public API — no API key, no install step).

```
 ▲ ALPHA TERMINAL  live crypto momentum desk                 ⣾ 16:50:24
  BTC $65,918 +0.23%   ETH $1,773 -0.38%   REGIME GREED / RISK-ON 73/100   adv 17/24

  ★ TOP CONVICTION RIGHT NOW
  HYPE/USDT  STRONG BUY (74/100)  confirmed momentum, trend intact
  entry $75.72   stop $73.10   tgt1 $79.20   tgt2 $84.10   vol $310.4M

  🚀 ABOUT TO EXPLODE  (volume + squeeze pre-breakout)
  ... ranked table with RSI, volume-σ, score meters, sparklines ...

  📈 BUY NOW  (confirmed momentum)
  ... ranked table ...

  TAPE  XPL ▲31.6% · ASTER ▲14.2% · ENA ▲11.0% · ...
```

---

## ⚠️ Read this first — NOT financial advice

**This tool does not predict the future. Nobody can.** What it does is measure
*real, observable* market structure — momentum, trend, volatility compression,
and abnormal volume — and rank coins by how closely they match historically
interesting setups. These are **probabilistic edges, not guarantees.**

- Signals are **right sometimes and wrong sometimes.** Breakouts fail. Trends reverse.
- Crypto is extremely volatile and **can go to zero.**
- This is **not** financial, investment, or trading advice.
- **Only risk what you can afford to lose.** Always do your own research.

The scoring is intentionally conservative: when the market is calm, the
"ABOUT TO EXPLODE" panel will be **empty** rather than inventing a signal.

---

## Run it

Requires Node.js 18+.

```bash
cd crypto-terminal

# 1) Live updating terminal dashboard (press q to quit, r to force a rescan)
node index.js
# or:  npm start

# 2) Web dashboard — open from your PHONE or PC browser (see "Phone + PC" below)
node server.js
# or:  npm run web      then visit http://<your-ip>:8787

# 3) One-shot ranked snapshot (great for logging / no-TTY environments)
node scan.js
# or:  npm run scan
```

Optional config via env vars:

| Variable           | Default | Meaning                                          |
|--------------------|---------|--------------------------------------------------|
| `ALPHA_BAR`        | `5m`    | Candle timeframe (`1m`,`5m`,`15m`,`1H`…)          |
| `ALPHA_TOP`        | `60`    | How many top-liquidity markets to scan           |
| `PORT`             | `8787`  | Web dashboard port (`server.js`)                 |
| `ALPHA_REFRESH_MS` | `15000` | Server-side rescan cadence for the web dashboard |
| `ALPHA_AI`         | `off`   | Local-AI briefing: `off` / `ollama` / `openai`   |
| `ALPHA_AI_MODEL`   | —       | Model name (e.g. `llama3`)                        |
| `ALPHA_AI_URL`     | —       | Override the AI endpoint URL                      |
| `ALPHA_AI_KEY`     | —       | Bearer key, if your endpoint needs one           |

```bash
ALPHA_BAR=15m ALPHA_TOP=80 node index.js
```

---

## 📱 Phone + PC access (web dashboard)

Run the web server **on your own machine**, then open it from any device on the
same Wi-Fi/LAN — phone, tablet, second PC:

```bash
npm run web          # or: node server.js
```

It prints a URL. On your phone's browser go to `http://<your-computer-ip>:8787`
(find your IP with `ipconfig` on Windows or `ifconfig`/`ip addr` on macOS/Linux).
The page is mobile-first, dark, and auto-refreshes — same signals as the terminal,
plus the AI briefing if enabled. One server can feed many devices at once.

## 📲 Install it as an app on your phone (PWA)

The dashboard is an installable **Progressive Web App** — served straight from
your NAS/PC, no App Store, works on iPhone and Android. It gets a home-screen
icon, launches fullscreen (no browser chrome), and the shell opens instantly
even offline (live data still needs a connection).

1. Start the server (`npm run web` or `docker compose up -d`).
2. On your phone's browser, open `http://<your-ip>:8787`.
3. Install it:
   - **iPhone (Safari):** Share → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**.
4. Launch it from the new ▲ icon — it runs like a native app.

> Tip: phones cache the app shell via a service worker, so it pops open
> immediately. To rebuild the icons, run `node lib/icon-gen.mjs`.

## 🧠 Connect your own local AI (optional)

The app can ask a model **running on your machine** to write a short "desk analyst"
briefing over the live signals. It's **off by default** and only narrates the
quantitative output — it never invents prices.

```bash
# Ollama (https://ollama.com) — start it, pull a model, then:
ALPHA_AI=ollama ALPHA_AI_MODEL=llama3 node server.js

# LM Studio / llama.cpp / vLLM (OpenAI-compatible endpoint):
ALPHA_AI=openai ALPHA_AI_MODEL=local-model \
  ALPHA_AI_URL=http://localhost:1234/v1/chat/completions node index.js
```

> **Note:** the AI must be reachable from wherever the app runs. Run the app on
> the same PC as your model (or point `ALPHA_AI_URL` at it on your LAN). A remote
> cloud session cannot reach a model on your home computer.

## 📊 Stocks too (not just crypto)

The dashboard and `scan.js` also show a **STOCKS MOVING** panel — live US-equity
movers run through the *same* momentum/explosion engine, sorted by the day's move.
Data comes from Yahoo Finance's public chart endpoint (no key). Edit the
`WATCHLIST` in `lib/stocks.js` to track your own names. Disable with
`ALPHA_STOCKS=off`. (Stocks only move during US market hours — off-hours the
panel goes quiet, which is expected.)

## 🖥️ Run it on your NAS / home server (with your RTX 5090)

Drop the folder on any box that runs Docker (Synology, TrueNAS, Unraid, a Linux
home server) and bring it up:

```bash
docker compose up -d
# then open http://<nas-ip>:8787 on your phone or PC
```

`docker-compose.yml` starts two services:

- **alpha** — the web dashboard on port `8787`.
- **ollama** — a local LLM server with your **RTX 5090 passed through** for the
  AI briefing. The GPU doesn't fetch data (the internet does that) — it runs the
  model that writes the desk note.

After first start, pull a model into Ollama once:

```bash
docker exec -it ollama ollama pull llama3
```

GPU passthrough needs the **NVIDIA Container Toolkit** on the host. If you don't
want AI, set `ALPHA_AI: "off"` in `docker-compose.yml` and you can delete the
`ollama` service entirely.

> Everything runs on **your** hardware and network — the app, the data fetching,
> and the model. Nothing depends on the cloud session that generated this code.

---

## How the signals actually work

Everything is computed from live OHLCV candles. No black box — read `lib/`.

### `BUY NOW` score — *confirmed momentum*
Ride trends that are already working, without chasing blow-off tops:

- **Linear-regression slope** of price (trend direction & strength)
- **EMA(9) > EMA(21)** trend alignment
- **MACD histogram** positive (momentum confirmation)
- **Rate-of-change** over 15 bars (real, recent gains)
- **RSI** rewarded in the 50–62 zone, **penalized above ~72** (avoid late chases)
- **Volume z-score** (participation must confirm the move)

### `ABOUT TO EXPLODE` score — *pre-breakout ignition*
The hard part: catching coins **before** the big candle, not after.

- **Volatility squeeze** — current Bollinger-band width vs. its recent self.
  Compression precedes expansion (the "coiled spring").
- **Volume ignition** — volume z-score spiking 1.5–4σ above its baseline. This
  is the trigger that turns a quiet base into a move.
- **Momentum just turning up** — short-window acceleration off the base.
- **Penalties** for already-overbought RSI and coins that already ran 25%+
  (those have *already* exploded — not "about to").

### Market regime
A breadth-based fear/greed proxy: % of liquid markets advancing + average
24h change across the board → `EXTREME FEAR … EXTREME GREED`.

### Trade geometry
Each idea shows a **mechanical** entry / ATR-based stop (1.5×) and two targets
(2× / 4× ATR) for context. They're a starting frame for your own risk plan —
**not** instructions.

---

## Architecture

```
crypto-terminal/
├── index.js            live TUI: fast price loop + rotating deep-scan loop
├── server.js           web dashboard (HTTP + JSON API) for phone/PC browsers
├── scan.js             one-shot ranked snapshot
├── Dockerfile          tiny zero-dep image
├── docker-compose.yml  NAS deploy: app + Ollama (RTX 5090 GPU)
└── lib/
    ├── okx.js          zero-dep OKX client (keep-alive, bounded concurrency)
    ├── stocks.js       live US-equity movers via Yahoo (same signal engine)
    ├── indicators.js   RSI, EMA, ATR, Bollinger width, slope, MACD, z-score…
    ├── signals.js      scoring engine (buy / explosion / regime / verdict)
    ├── engine.js       shared scan() used by terminal, web, and snapshot
    ├── ai.js           optional local-AI briefing (Ollama / OpenAI-compatible)
    └── render.js       ANSI colors, sparklines, meters, layout helpers
```

**Why it feels live with no lag:** two independent loops. A cheap ~1.5s call
pulls *all* spot tickers in one request (live prices, tape, regime), while a
staggered deep loop fetches candles for the most liquid markets with bounded
concurrency and re-ranks every ~20s. The whole frame is composed in memory and
written in a single atomic repaint, so there's no flicker.

Data source: [OKX public market API](https://www.okx.com/docs-v5/) — no key required.
