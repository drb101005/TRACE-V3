# Deployment: Vercel, Render, and Supabase

## Architecture

- Vercel builds and serves the Vite SPA from `frontend/`.
- The browser calls the FastAPI service on Render using `VITE_API_BASE_URL`.
- FastAPI connects to Supabase PostgreSQL with `DATABASE_URL` and owns all database access. Do not put database credentials or Supabase service keys in frontend environment variables.
- Uploaded evidence is currently written to `TRACE_DATA_DIR/uploads`. The Render Blueprint mounts a persistent disk at `/var/data` so those files survive service restarts and deploys. A Render disk is single-instance storage; this configuration is for one API instance.

## Vercel

1. Import the repository and set **Root Directory** to `frontend`.
2. Use the Vite defaults: install `npm install`, build `npm run build`, output `dist`.
3. Add `VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1` to the Production environment (and Preview if desired), then redeploy.
4. Keep `frontend/vercel.json`; it sends SPA paths such as `/reports` to `index.html`.

## Supabase

1. Create a Supabase project and open **Connect**.
2. Use the **Session Pooler** connection string for Render, which needs IPv4-compatible database connectivity. Use the parameters Supabase provides and ensure SSL is required (`sslmode=require`).
3. Set the complete connection string as Render `DATABASE_URL`. URL-encode reserved characters in the password.
4. The API uses SQLAlchemy with psycopg 3 and initializes tables/migrations on startup. Keep the database URL only in Render secrets.

## Render

The root `render.yaml` defines the FastAPI web service and a persistent disk. Create a Blueprint from it and provide:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Session Pooler PostgreSQL connection string |
| `TRACE_CORS_ORIGINS` | Exact deployed Vercel origin(s), comma-separated, no path; e.g. `https://your-app.vercel.app` |
| `TRACE_BOOTSTRAP_ADMIN_EMAIL` | Initial administrator email |
| `TRACE_BOOTSTRAP_ADMIN_PASSWORD` | Strong initial administrator password |

Render generates `TRACE_SECRET_KEY` and sets `TRACE_DATA_DIR=/var/data`. Do not remove the disk or point `TRACE_DATA_DIR` elsewhere unless uploads are moved to persistent object storage. This disk configuration requires a Render plan that supports persistent disks and limits the service to one instance.

For a custom Vercel domain, add that origin to `TRACE_CORS_ORIGINS` and redeploy/restart the API. CORS entries are origins only: scheme + host + optional port.

## Local Supabase database (optional)

Set `DATABASE_URL` in the repository-root `.env` to a Supabase PostgreSQL connection string before starting FastAPI. The local `.env.example` leaves SQLite as the default. Uploaded files remain in the local `TRACE_DATA_DIR` even when the database is Supabase.
