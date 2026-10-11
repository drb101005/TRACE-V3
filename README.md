# TRACE — audit workspace

TRACE is a React + Vite frontend connected to a FastAPI backend. Authenticated workspace data is loaded from the backend and its database; the frontend does not ship example users, engagements, findings, documents, or audit activity.

## Run the backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set TRACE_SECRET_KEY and Google OAuth credentials in .env. The administrator signs in as drb.genai@gmail.com.
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## Run the frontend

In another terminal:

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. In development, Vite proxies API requests to `http://127.0.0.1:8000`.

## Tests and build

```bash
.venv/bin/pytest -q
npm run build
```

Run browser checks with Node.js 20 or later:

```bash
npm run test:e2e
```

See [docs/BACKEND.md](docs/BACKEND.md) for endpoints, storage, migrations, access grants, and processing limits. See [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md) for frontend data sources.
