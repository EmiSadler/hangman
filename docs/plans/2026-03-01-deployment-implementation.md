# Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Dungeon Hangman — Flask backend on Render's free tier, Vite/React frontend on Vercel's free tier — with zero frontend code changes.

**Architecture:** `vercel.json` in `frontend/` proxies `/api/*` to the Render URL so relative API calls work identically in dev and production. `render.yaml` at the repo root configures Render to build and run the Flask app with gunicorn.

**Tech Stack:** Python 3.11, gunicorn, Flask; Vite/React, Vercel, Render.

---

### Task 1: Add gunicorn and pin Python version for Render

Flask's built-in dev server is not suitable for production. Render needs gunicorn to serve the app. We also pin Python 3.11 so Render uses the same version as development.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/.python-version`

**Step 1: Add gunicorn to requirements**

Open `backend/requirements.txt`. Add `gunicorn` as a new line (exact version not required — Render will install latest compatible):

```
blinker==1.9.0
click==8.3.1
Flask==3.1.3
flask-cors==6.0.2
itsdangerous==2.2.0
Jinja2==3.1.6
MarkupSafe==3.0.3
Werkzeug==3.1.6
gunicorn
pytest==8.3.5
```

**Step 2: Create `.python-version`**

Create `backend/.python-version` with exactly:
```
3.11
```

This tells Render which Python version to use (it reads `.python-version` from the build root, which is `backend/` per `render.yaml`).

**Step 3: Verify gunicorn starts the app locally**

```bash
cd backend
source venv/bin/activate
pip install gunicorn
gunicorn app:app
```

Expected output:
```
[INFO] Starting gunicorn
[INFO] Listening at: http://127.0.0.1:8000
[INFO] Worker booted
```

Hit Ctrl+C to stop. If it starts without errors, gunicorn works.

**Step 4: Run backend tests to confirm nothing broke**

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

Expected: all 55 tests pass.

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/.python-version
git commit -m "feat: add gunicorn and pin Python 3.11 for Render deployment"
```

---

### Task 2: Create render.yaml

`render.yaml` at the repo root lets Render auto-configure the web service when the repo is connected. No manual clicking required beyond the initial "New Web Service" button.

**Files:**
- Create: `render.yaml` (repo root)

**Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: hangman-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    plan: free
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
```

**Step 2: Verify YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('render.yaml'))" && echo "YAML valid"
```

Expected: `YAML valid`

(If `pyyaml` is not installed: `pip install pyyaml` first, or just visually check indentation.)

**Step 3: Commit**

```bash
git add render.yaml
git commit -m "feat: add render.yaml for Render web service config"
```

---

### Task 3: Create vercel.json for API proxy

Vercel needs to know how to proxy `/api/*` requests to the Render backend. We place `vercel.json` inside `frontend/` — that's where Vercel's root directory will be set.

The destination URL contains a placeholder (`YOUR_RENDER_URL`) that gets replaced in Task 5 after the Render service is live.

**Files:**
- Create: `frontend/vercel.json`

**Step 1: Create `frontend/vercel.json`**

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RENDER_URL/api/:path*"
    }
  ]
}
```

**Step 2: Verify the frontend still builds cleanly**

```bash
cd frontend
npm run build
```

Expected: build succeeds, `frontend/dist/` directory created with `index.html` and assets. No errors.

**Step 3: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat: add vercel.json with API proxy rewrite (placeholder URL)"
```

**Step 4: Push everything to GitHub**

```bash
git push
```

---

### Task 4: Create the Render web service (manual)

This is a one-time manual setup in the Render dashboard. No code changes.

**Step 1: Go to [render.com](https://render.com) and sign in (or create a free account)**

**Step 2: New Web Service**

- Click "New +" → "Web Service"
- Connect your GitHub account if not already connected
- Select the `hangman` repository
- Render will detect `render.yaml` and pre-fill all settings

**Step 3: Verify settings before deploying**

Confirm these values in the Render UI:
| Setting | Expected value |
|---------|---------------|
| Name | `hangman-api` |
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn app:app` |
| Plan | Free |

**Step 4: Click "Create Web Service"**

Render will build and deploy. This takes 2–5 minutes. Watch the deploy log for:
```
==> Build successful
==> Starting service with 'gunicorn app:app'
==> Your service is live
```

**Step 5: Copy the service URL**

After deployment, the URL shown at the top of the Render dashboard looks like:
```
https://hangman-api.onrender.com
```
(the exact subdomain depends on the name and a random suffix Render adds if there's a conflict)

Copy this URL — you need it in Task 5.

**Step 6: Test the live backend**

```bash
curl https://YOUR_RENDER_URL/
```

Expected:
```json
{"message": "Hangman API running!"}
```

```bash
curl -X POST https://YOUR_RENDER_URL/api/game \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: JSON with `game_id`, `masked_word`, etc.

---

### Task 5: Update vercel.json with the real Render URL

Replace the placeholder with the actual Render URL from Task 4.

**Files:**
- Modify: `frontend/vercel.json`

**Step 1: Update the destination**

Replace `YOUR_RENDER_URL` with the actual Render URL. Example:

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

**Step 2: Commit and push**

```bash
git add frontend/vercel.json
git commit -m "feat: set Render backend URL in vercel.json"
git push
```

---

### Task 6: Create the Vercel project (manual)

One-time manual setup in the Vercel dashboard.

**Step 1: Go to [vercel.com](https://vercel.com) and sign in (or create a free account)**

**Step 2: New Project**

- Click "Add New…" → "Project"
- Import from GitHub → select the `hangman` repository

**Step 3: Configure the project**

In the "Configure Project" screen:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` (auto-detected) |
| Output Directory | `dist` (auto-detected) |

**Step 4: Click "Deploy"**

Vercel builds the frontend. Takes ~1 minute. Watch for:
```
✓ Build completed
✓ Deployment ready
```

**Step 5: Open the deployed URL**

Vercel provides a URL like `https://hangman-abc123.vercel.app`. Open it in your browser.

**Step 6: Verify end-to-end**

1. The app loads (RunSetup screen appears)
2. Click "Start Run" — a word game starts (this hits `/api/game` which proxies to Render)
3. If Render was idle, the first request may take ~30–50s (cold start) — this is normal
4. Play through a room — guesses work correctly

If Step 2 returns an error, check:
- The Render URL in `vercel.json` matches the actual Render URL exactly
- The Render service is showing "Live" in the Render dashboard
