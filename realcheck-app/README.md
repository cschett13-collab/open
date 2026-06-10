# ◎ RealCheck — *Is it real or fake?*

An AI "reality checker" for your PC. Paste **any text, link, or screenshot** and
get an instant, plain-English verdict on whether it's **genuine, AI-generated,
or a scam** — with a confidence score, the specific red flags it found, and one
clear next step.

> The product idea: one button that connects to everything on your screen and
> tells you, right away, if what you're looking at is real. This repo is a
> working MVP of that idea.

![tabs: text · link · image](https://img.shields.io/badge/checks-text%20%C2%B7%20link%20%C2%B7%20image-5b8cff)

## What it does

| Input | What RealCheck looks for |
|-------|--------------------------|
| **Text / message** | Scam & phishing language, pressure tactics, impersonation, AI-writing tells, misleading framing |
| **Link / URL** | Lookalike domains, brand impersonation, raw-IP hosts, risky TLDs; fetches the page for context |
| **Image / screenshot** | AI-generation & deepfake artifacts (warped hands/text, lighting), signs of editing, scam layouts |

Every check returns: a **verdict** (`real / fake / ai_generated / scam / misleading / uncertain`),
a calibrated **confidence %**, a list of concrete **signals**, and a practical **recommendation**.

## Run it

```bash
cd realcheck-app
npm install
npm start            # → http://localhost:3000
```

It runs immediately in **demo mode** (transparent rule-based engine). To turn on
the full AI engine — including image/deepfake analysis — add a Claude API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # now powered by Claude (claude-opus-4-8) with vision
```

## How it works

- **Backend** (`server.js`) — Express API with a single `POST /api/check` endpoint.
  When a key is present it calls **Claude with adaptive thinking and a strict
  JSON-schema structured output** (vision is used for images). With no key, it
  falls back to a readable heuristic engine so the app is always demoable. If the
  AI call ever fails, it degrades gracefully to the heuristic instead of erroring.
- **Frontend** (`public/`) — a single-page UI: tabbed input, drag-and-drop image
  upload, an animated confidence gauge, and color-coded signal cards.

```
realcheck-app/
├── server.js            # API + Claude integration + heuristic fallback
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── .env.example
```

## API

```bash
curl -X POST http://localhost:3000/api/check \
  -H 'Content-Type: application/json' \
  -d '{"type":"text","content":"URGENT: verify your account now or it will be suspended"}'
```

```jsonc
{
  "verdict": "scam",
  "confidence": 86,
  "headline": "Looks like a scam",
  "summary": "...",
  "signals": [{ "label": "Pressure / lure language", "severity": "danger", "detail": "..." }],
  "recommendation": "Do not click. Contact the company through its official site.",
  "engine": "claude"
}
```

`type` is one of `text`, `url`, or `image` (image `content` is base64 with a `mediaType`).

## Where this goes next (the roadmap that sells it)

- 🧩 **Browser extension & screenshot hotkey** — "check whatever's on screen" in one keypress.
- 🔌 **Connect everything** — email, DMs, and chat apps scanned inline.
- 🗂️ **Source-backed fact checks** — pull live web evidence and cite it.
- 🏢 **Team / API plan** — drop-in fraud & deepfake screening for support and trust teams.

## Disclaimer

RealCheck gives a calibrated opinion, not a guarantee. Always verify high-stakes
claims through an independent, official source.
