# TRACE MCP server

The MCP adapter is a separate process in `mcp_server/server.py`. It calls the existing FastAPI endpoints over HTTP with a bearer token. It does not access SQLAlchemy/database files, add FastAPI routes, or change the upload, analysis, audit, or report pipelines. Backend role and engagement grants remain enforced by FastAPI.

## Connect from VS Code

1. Install project dependencies: `pip install -r requirements.txt` in the repository's `.venv`.
2. Start the FastAPI backend as usual at `http://127.0.0.1:8000`.
3. Sign in to TRACE in the frontend. The MCP server needs the account's API bearer token; in browser developer tools it is stored in session storage as `trace-access-token` for the frontend origin.
4. Open the workspace in VS Code. The workspace configuration at `.vscode/mcp.json` prompts for this token as a password and starts the MCP server over stdio.
5. Restart the MCP server from VS Code's MCP Servers view if it was already running before dependencies were installed or the backend was started.

The token is not written into the workspace configuration. It is passed to the local MCP process as `TRACE_ACCESS_TOKEN`. Use an account that has only the permissions needed for the task, and do not paste the token into source files or commit it.

## Exposed tools

The read tools return live API data: `trace_health`, `trace_current_user`, `trace_list_engagements`, `trace_list_evidence`, `trace_list_procedure_catalog`, `trace_list_procedure_runs`, `trace_list_findings`, `trace_list_audit_events`, and `trace_verify_audit_integrity`.

`trace_generate_report` creates a report version and audit event through the existing report endpoint. `trace_run_procedure` and `trace_run_sampling` execute and persist runs through the current API. These tools are explicitly described as writes when offered to the MCP client. Server-side role and engagement grants still apply.

For another MCP host, launch the same module in stdio mode with the environment variables `TRACE_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`), `TRACE_BACKEND_URL` (default `http://127.0.0.1:8000`), and `TRACE_ACCESS_TOKEN`:

```bash
TRACE_ACCESS_TOKEN='<your bearer token>' .venv/bin/python -m mcp_server.server
```
