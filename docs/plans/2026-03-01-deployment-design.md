# Deployment Design
_2026-03-01_

## Overview

Deploy the Dungeon Hangman app for free using Render (Flask backend) and Vercel (Vite/React frontend).

---

## Architecture

```
Browser
  │
  ├── Static assets (HTML/JS/CSS)  ←  Vercel (CDN, always-on, free)
  │
  └── /api/* requests  →  Vercel rewrite proxy  →  Render web service (Flask)
```

The Vercel project rewrites `/api/*` to the Render URL, so the frontend code makes the same relative API calls in production as in development. No frontend code changes required.

---

## Services

### Backend — Render Web Service (free tier)
- **Runtime:** Python
- **Root directory:** `backend/`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app:app`
- **Plan:** Free (spins down after 15 min idle; ~30–50s cold start on first request)
- **Auto-deploy:** on every push to `main`

### Frontend — Vercel (free hobby plan)
- **Root directory:** `frontend/`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Auto-deploy:** on every push to `main`

---

## Code Changes

| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `gunicorn` |
| `render.yaml` (new, repo root) | Render service definition |
| `vercel.json` (new, repo root) | Rewrite `/api/*` → Render URL |

### `render.yaml`
```yaml
services:
  - type: web
    name: hangman-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    plan: free
```

### `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://hangman-api.onrender.com/api/:path*"
    }
  ]
}
```
_(destination URL updated after Render service is created)_

---

## One-Time Setup Steps (manual)

1. Push code changes to GitHub
2. render.com → New Web Service → connect repo → Render reads `render.yaml`
3. Copy the Render service URL
4. Update `vercel.json` destination with the real Render URL → push
5. vercel.com → New Project → import repo → set root directory to `frontend`

After setup, both services auto-deploy on every push to `main`.

---

## Limitations

- Render free tier cold-starts (~30–50s) after 15 min idle
- In-memory `games` dict in Flask resets on restart — active word guesses are lost, but dungeon run state (HP, coins, floor) survives in `localStorage`
- No custom domain on free tier (Render and Vercel both provide `*.onrender.com` / `*.vercel.app` URLs)
