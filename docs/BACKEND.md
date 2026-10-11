# TRACE FastAPI backend

## Start locally

Use Python 3.10 or later. From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # edit the secret and Google OAuth credentials
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The Vite development server proxies `/api` and `/health` to port 8000. Start the frontend in a second terminal with `npm install && npm run dev`. Open `http://127.0.0.1:5173`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

The default SQLite database and uploaded files live in `./data`. Set `DATABASE_URL` to use another SQLAlchemy database URL, `TRACE_DATA_DIR` to move local state, `TRACE_MAX_UPLOAD_BYTES` to adjust the upload cap, and `TRACE_CORS_ORIGINS` to set allowed browser origins. `TRACE_SECRET_KEY` must be a strong random secret outside local development. The platform administrator is fixed to `drb.genai@gmail.com` and is created at the first successful Google sign-in; no bootstrap credential is used.

## Workflow implemented

- Google is the only sign-in provider. The backend verifies Google's identity token and verified email before issuing a TRACE bearer token. Self-registration, password login, password changes, and password storage are removed. The frontend stores the access token in `sessionStorage`.
- The fixed administrator is `drb.genai@gmail.com`. Admins add client/auditor Gmail addresses through Users or `POST /api/v1/admin/users`; those users can sign in directly with Google. Client accounts receive an isolated company at provisioning. Company names are not treated as proof of tenant membership.
- Clients create and update engagements, upload files, review their dataset profiles, and choose an auditor.
- Client assignment accepts a list of grants: `organization`, `period`, `scope`, `required_records`, `documents`, `transactions`, `findings`, `events`, `report`, `checks`, and `sampling`. An auditor gets only the granted fields/endpoints. Grants can be changed with `PUT /api/v1/engagements/{id}/access`.
- Uploads are size limited, stored under generated names outside the static frontend with owner-only local permissions, SHA-256 fingerprinted, and listed without exposing the filesystem path. CSV/TSV/XLSX/XLSM/JSON tables use a bounded Pandas pipeline that preserves identifier strings, rejects duplicate headers, profiles missing values, numeric summaries, candidate mappings, and date ranges. PDF/DOC/DOCX evidence is retained and fingerprinted but not parsed.
- Auditor/client check endpoints persist versioned deterministic exceptions (missing/duplicate invoice IDs, negative amounts, invoice arithmetic, duplicate rows) and risk indicators. Sampling supports seeded random, risk-prioritized, and targeted selections and records human-review requirements. Snapshots, findings, evidence requests, review decisions, exports, versioned report hashes, and continuous comparisons are available under `/api/v1/audit`.
- Events are chained with SHA-256 and can be checked through `GET /api/v1/audit/{id}/audit-integrity`. This is a tamper-evident application log, not a blockchain or a guarantee against a privileged database operator.
- Platform administrators have operational user/engagement metadata and abstracted event records. They cannot download evidence or access transaction data, findings, checks, or reports.

## Schema changes and tests

Startup applies versioned SQLite migrations from `backend/migrations.py`. Existing workflow rows are preserved; legacy clients receive isolated company records and their engagements remain linked to their original client. Migration 6 removes the old credential hash and login-attempt table, revokes existing sessions, and disables all accounts except the designated administrator. The administrator can re-enable a legacy account by adding its Gmail address again. Back up `data/trace.db` before deployment as a standard recovery measure. Tests configure their own database under the operating system temporary directory and do not use `data/trace.db`.

```bash
.venv/bin/pytest -q
```

## Main endpoints

`GET /health`; `GET /api/v1/auth/google/start`; `GET /api/v1/auth/google/callback`; `GET /api/v1/auth/me`; `POST/GET /api/v1/admin/users`; `PATCH /api/v1/admin/users/{user_id}/active`; `POST/GET /api/v1/engagements/`; `PATCH /api/v1/engagements/{id}`; `POST /api/v1/engagements/{id}/assign`; `PUT /api/v1/engagements/{id}/access`; `POST/GET /api/v1/uploads/{id}/upload(s)`; `POST /api/v1/uploads/{id}/validate/{artifact_id}`; and audit routes for snapshots, transactions, sampling, checks, findings/review, reports, scanning, exports, events, and integrity.

## Data processing boundary

CSV/TSV/XLSX/JSON checks are deterministic profiling, not AI assurance, accounting conclusions, fraud detection, or professional audit opinions. PDF/DOC/DOCX bytes are retained and hashed, but their contents are not extracted. Sampling is a reproducible technical selection, not a statistical sufficiency calculation. Production deployment, malware scanning, external object storage, a formal immutable ledger, and independent security review require separate integrations before production use.

## Google sign-in

Google OAuth is the sole authentication provider. Configure `TRACE_GOOGLE_CLIENT_ID`, `TRACE_GOOGLE_CLIENT_SECRET`, and `TRACE_GOOGLE_REDIRECT_URI` in `.env`. The default local callback is `http://127.0.0.1:8000/api/v1/auth/google/callback`. Set `VITE_API_ORIGIN=http://127.0.0.1:8000` for the frontend popup. The admin is created automatically at first sign-in; other Gmail addresses must be provisioned by the admin. OAuth state and nonce are checked. Migration 6 removes stored password hashes and the password-login attempt table.

See [GOOGLE-OAUTH.md](GOOGLE-OAUTH.md) for the Google Cloud Console values and local setup steps.
