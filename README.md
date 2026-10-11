# TRACE

TRACE is an evidence-led revenue audit workspace. It combines a React web application with a FastAPI service for authentication, engagement management, evidence handling, deterministic data checks, reporting, and audit history.

The frontend is in `frontend/`; the API and data pipeline are in `backend/`. The API is the source of truth for users, permissions, and workspace records. The frontend does not ship demo users, engagements, or audit results.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Build and tests](#build-and-tests)
- [Deployment](#deployment)
- [MCP server](#mcp-server)
- [Data and audit boundaries](#data-and-audit-boundaries)
- [More documentation](#more-documentation)

## Features

- Password-based sign-in and role-aware client, auditor, and platform administrator workflows.
- Client companies and audit engagements, with auditor assignment and engagement-level access grants.
- Evidence upload, listing, validation, download, and SHA-256 fingerprints.
- Pandas profiling and deterministic checks for supported tabular data.
- Sampling, review decisions, findings, evidence requests, versioned reports, and audit events.
- D3 report charts built from analysis returned by the API.
- A separate MCP adapter that accesses the existing API using a bearer token.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, D3 |
| Backend | Python, FastAPI, SQLAlchemy, Pandas |
| Local database | SQLite |
| Production database | Supabase PostgreSQL |
| Hosting | Vercel frontend, Render API |
| Browser checks | Playwright |

Supabase provides PostgreSQL in this deployment. Authentication and application APIs remain in FastAPI. Uploaded files are stored under `TRACE_DATA_DIR/uploads`; on Render, a persistent disk is needed if files must survive restarts and deploys.

## Repository layout

```text
backend/            FastAPI routes, SQLAlchemy models, migrations, and analysis services
frontend/           React/Vite app, static assets, package files, and Playwright specs
mcp_server/         Optional stdio MCP adapter for the FastAPI API
tests/              Python API and data-pipeline tests
docs/               API, backend, deployment, MCP, and product notes
render.yaml         Render Blueprint for the API
requirements.txt    Python dependencies
```

## Run locally

Use Python 3.10 or later and Node.js 20 or later.

### 1. Set up the backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set a private `TRACE_SECRET_KEY` and initial admin credentials. Then run:

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API is at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`, and the health endpoint is `http://127.0.0.1:8000/health`.

### 2. Set up the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`. In local development, Vite proxies `/api` and `/health` requests to the backend on port 8000.

You can also start the API from the `frontend/` directory with `npm run dev:api`; the normal workflow above starts each service in its own terminal.

### Local database and admin

By default, the backend creates `data/trace.db` and stores uploaded files in `data/uploads/`. The first startup creates the schema and bootstraps the configured administrator when that account is absent or has no password hash. The sample `.env.example` includes `drb.genai@gmail.com` as the bootstrap email; replace the example password before using it.

## Configuration

Backend variables are read from the repository-root `.env`:

| Variable | Purpose |
| --- | --- |
| `TRACE_SECRET_KEY` | Signs API bearer tokens. Use a long, random secret outside local development. |
| `DATABASE_URL` | Optional SQLAlchemy database URL. If unset, SQLite is used. For production, use the Supabase PostgreSQL Session Pooler URL. |
| `TRACE_DATA_DIR` | Location for the local SQLite file and uploaded evidence. Defaults to `./data`. |
| `TRACE_CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. |
| `TRACE_MAX_UPLOAD_BYTES` | Maximum upload size in bytes. Defaults to 50 MiB. |
| `TRACE_TOKEN_MINUTES` | Bearer-token lifetime in minutes. Defaults to 1440. |
| `TRACE_BOOTSTRAP_ADMIN_EMAIL` | Email for the initial platform administrator. |
| `TRACE_BOOTSTRAP_ADMIN_PASSWORD` | Password set when the admin is first created or has no password hash. |

For the deployed frontend, set `VITE_API_BASE_URL` in Vercel to the Render API URL ending in `/api/v1`, for example `https://your-api.onrender.com/api/v1`. Vite environment variables are included in browser code, so never put database credentials, signing keys, or service-role keys in a `VITE_*` variable.

Do not commit `.env` or paste secrets into source files. The checked-in `.env.example` contains placeholders for local setup.

## Build and tests

Build the frontend:

```bash
cd frontend
npm run build
```

Run browser checks (Node.js 20 or later):

```bash
cd frontend
npm run test:e2e
```

Run Python tests from the repository root with the virtual environment active:

```bash
python -m pytest -q
```

## Deployment

The intended deployment is:

```text
Browser → Vercel (frontend) → Render (FastAPI) → Supabase PostgreSQL
                                      └──────→ persistent disk for uploaded evidence
```

1. Create a Supabase project and copy its **Session Pooler** PostgreSQL connection string from **Connect**. Require SSL and keep the URL private.
2. Deploy the frontend on Vercel with Root Directory set to `frontend`. The included `frontend/vercel.json` supports direct navigation to React Router paths.
3. Deploy the API on Render from the root `render.yaml` Blueprint, or configure a Web Service with `pip install -r requirements.txt` and `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
4. In Render, set `DATABASE_URL`, `TRACE_CORS_ORIGINS` to the exact Vercel origin, and the bootstrap admin email/password. `TRACE_SECRET_KEY` is generated by the Blueprint.
5. In Vercel, set `VITE_API_BASE_URL` to `https://<render-service>.onrender.com/api/v1` and redeploy.

The included Render Blueprint mounts a disk at `/var/data` and sets `TRACE_DATA_DIR` there. Persistent disks require a paid Render service and are single-instance storage. Without one, uploaded files can be lost when the service restarts or deploys. The deployment does not automatically migrate records or uploads from a local `data/` directory to Supabase/Render.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for exact dashboard steps and environment-variable details.

## MCP server

The optional MCP server is a separate stdio process. It calls the existing FastAPI endpoints with a bearer token; it does not connect directly to the database or replace backend authorization.

VS Code configuration is in `.vscode/mcp.json`. Start the backend, sign in to TRACE, then provide the session’s API token when VS Code prompts. See [docs/MCP-SERVER.md](docs/MCP-SERVER.md) for setup and available tools.

## Data and audit boundaries

- CSV, TSV, XLSX, XLSM, and JSON tables are supported for profiling and checks. PDF and Word files are retained and fingerprinted but their text is not extracted.
- Data checks and report calculations are deterministic review aids; they do not make accounting conclusions, detect fraud, or provide an audit opinion.
- Sampling is reproducible technical selection, not a statistical sufficiency calculation.
- The audit event chain is tamper-evident application history, not a blockchain or protection from a privileged database operator.
- Malware scanning, external object storage, background processing, and independent security review are not configured in this project.

## More documentation

- [Backend setup, endpoints, permissions, storage, and migrations](docs/BACKEND.md)
- [Frontend/API integration and report data](docs/API-INTEGRATION.md)
- [Deployment configuration](docs/DEPLOYMENT.md)
- [MCP server setup](docs/MCP-SERVER.md)
- [Product boundaries](docs/PRODUCT-BOUNDARIES.md)
