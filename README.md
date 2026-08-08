<!-- Badges / Links -->
[![Demo](https://img.shields.io/badge/Demo-Live_Preview-4BC51D?style=for-the-badge&logo=googlechrome&logoColor=white)]([DEMO_URL_BURAYA](https://fred-diff-molecules-explicitly.trycloudflare.com/))
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **🚀 Live Demo:** [(https://fred-diff-molecules-explicitly.trycloudflare.com/)]([Demo))  

# Whisper Transcribe App

A full-stack app that transcribes/translates audio to text using **OpenAI's Whisper model running
100% locally** (via [`nodejs-whisper`](https://www.npmjs.com/package/nodejs-whisper), which wraps
`whisper.cpp` - no OpenAI API key, no network calls, no audio ever leaves the server).

## Stack

- **Frontend:** React (Vite) + React Router
- **Backend:** Node.js + Express, JWT auth, SQLite (`better-sqlite3`)
- **Transcription:** local `whisper.cpp` via `nodejs-whisper` (CPU inference)
- **Tiers:** Free / Pro / Plus, each with a different Whisper model size and usage quota

## Plans

| Plan | Model  | Monthly minutes | Max file length |
|------|--------|------------------|------------------|
| Free | tiny   | 10               | 5 min            |
| Pro  | base   | 120              | 30 min           |
| Plus | small  | Unlimited        | 60 min           |

Plan switching in this build is a **mock upgrade** (no payment processing) - intended for a
self-hosted instance. Wire up Stripe (or similar) in `backend/src/routes/plan.routes.js` if you
need real billing.

## Local development

```bash
# Backend
cd backend
npm install
npx nodejs-whisper download   # interactive - pick tiny/base/small, or rely on autoDownloadModelName
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000`.

Requires `ffmpeg`, `cmake`, and a C++ toolchain (`make`/`g++`) on your machine/host so
`nodejs-whisper` can compile `whisper.cpp` on first use.

## Docker

```bash
docker build -t whisper-app .
docker run -p 3500:3000 -e JWT_SECRET=change-me -v whisper-data:/app/data whisper-app
```

The image bakes in `tiny`, `base`, and `small` models at build time, so the container starts
ready to transcribe with no first-request delay.

## Environment variables

| Variable            | Default             | Description                          |
|---------------------|----------------------|---------------------------------------|
| `PORT`               | `3000`              | HTTP port                            |
| `JWT_SECRET`         | dev default          | **Set this in production!**          |
| `DATA_DIR`           | `./src/data`         | SQLite database directory            |
| `WHISPER_MODEL_ROOT` | OS tmp dir           | Where ggml model files are cached    |
| `ADMIN_EMAILS`       | (none)               | Comma-separated emails auto-promoted to admin on signup/login/startup |

## Admin

Any account whose email is listed in `ADMIN_EMAILS` is automatically granted admin access
(checked at signup, login, and server startup, so it survives redeploys). Admins get an **Admin**
link in the navbar leading to `/admin`, where they can:

- View every user's plan, monthly usage, and transcription count
- Change a user's plan (Free/Pro/Plus)
- Reset a user's monthly usage
- Grant/revoke admin access for other users (at least one admin must always remain)
- Delete a user and their data

All of this is backed by `POST/PATCH/DELETE /api/admin/users/...` routes, which require a valid
JWT for a user with `is_admin = 1` (enforced server-side, not just hidden in the UI).
