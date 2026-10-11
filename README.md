# TRACE — audit workspace

TRACE is a React + Vite frontend in [`frontend/`](frontend/) and a FastAPI backend in [`backend/`](backend/). The backend owns authentication and application data. In production it connects to Supabase PostgreSQL; uploaded evidence is stored on the Render persistent disk.

## Run locally

Start the backend from the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set TRACE_SECRET_KEY and the initial administrator credentials in .env.
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app at `http://127.0.0.1:5173` and proxies `/api` and `/health` to FastAPI. The default local database and uploaded files are in `./data`.

## Build and browser checks

```bash
cd frontend
npm run build
npm run test:e2e
```

Python tests remain at the repository root and can be run with `.venv/bin/pytest -q`.

## Deploy

- **Vercel:** set the project Root Directory to `frontend`. The included `frontend/vercel.json` supports React Router deep links. Set `VITE_API_BASE_URL` to `https://<your-render-service>.onrender.com/api/v1` for production and redeploy.
- **Render:** create a Blueprint from the root [`render.yaml`](render.yaml). Fill the prompted `DATABASE_URL`, `TRACE_CORS_ORIGINS`, and bootstrap admin values in Render. `TRACE_CORS_ORIGINS` should contain the exact Vercel origin, such as `https://your-app.vercel.app` (no path). Keep the configured persistent disk mounted at `/var/data`; the backend stores uploaded evidence there.
- **Supabase:** use the project’s PostgreSQL database as the backend database, not the browser client. Put the Supabase **Session Pooler** URI (IPv4-compatible for Render) in Render’s `DATABASE_URL`; use the pooler details shown in Supabase Connect, include `sslmode=require`, and URL-encode special characters in the password. Never put this URI or a Supabase service-role key in a `VITE_*` variable.

The first Render startup creates the schema and bootstraps the admin from the configured email/password when that account is absent or has no password hash. Set these values before the first startup. Keep them private and use a strong password. Supabase schema setup is performed by the backend; do not expose database credentials in Vercel.

See [docs/BACKEND.md](docs/BACKEND.md) for API, data storage, migrations, and limits; [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md) for frontend data sources; and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment configuration.
