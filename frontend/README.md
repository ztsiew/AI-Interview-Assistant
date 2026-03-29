# Interview Co-Pilot (React + Ant Design)

This folder is a React replacement for `frontend.html`, using Ant Design components.

## Backend API

This UI calls the FastAPI backend (`ia_backend.py`) endpoints:

- `POST /upload_plan`
- `POST /update_config`
- `POST /start`
- `POST /stop`
- `GET /status`

## Run (Windows)

1) Start the backend:

```powershell
python ia_backend.py
```

2) Install Node.js (includes `node` + `npm`) from the official site, then reopen your terminal.

3) Install and run the frontend:

```powershell
cd "frontend-react"
npm install
npm run dev
```

Open the dev URL Vite prints (typically `http://localhost:5173`).

### API URL / Proxy

By default the frontend uses `VITE_API_URL=/api` and Vite proxies `/api/*` → `http://localhost:8000/*` (see `vite.config.ts`).

If you prefer to call the backend directly, create a local env file:

- Copy `env.example` to `.env.local` (or `.env`) and set:
  - `VITE_API_URL=http://localhost:8000`





