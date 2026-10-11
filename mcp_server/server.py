"""Local stdio MCP server that delegates work to the existing TRACE API."""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote

import httpx
from mcp.server import MCPServer

server = MCPServer("TRACE Backend")

API_BASE_URL = os.getenv("TRACE_API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
BACKEND_URL = os.getenv("TRACE_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("TRACE_MCP_TIMEOUT_SECONDS", "30"))


async def _request(method: str, path: str, *, params: dict[str, Any] | None = None, body: dict[str, Any] | None = None, health: bool = False) -> Any:
    """Make a request through the existing API, preserving its authorization rules."""
    token = os.getenv("TRACE_ACCESS_TOKEN", "").strip()
    if not health and not token:
        raise ValueError("Set TRACE_ACCESS_TOKEN to a TRACE API bearer token before starting the MCP server.")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    url = f"{BACKEND_URL}/health" if health else f"{API_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.request(method, url, headers=headers, params=params, json=body)
    except httpx.RequestError as exc:
        raise RuntimeError(f"Cannot reach TRACE API at {url}: {exc}") from exc
    if not response.is_success:
        try:
            payload = response.json()
            detail = payload.get("detail", response.text)
        except ValueError:
            detail = response.text
        raise RuntimeError(f"TRACE API returned HTTP {response.status_code}: {detail}")
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


def _engagement_path(engagement_id: str, suffix: str) -> str:
    if not engagement_id.strip():
        raise ValueError("engagement_id is required")
    return f"/audit/{quote(engagement_id, safe='')}/{suffix.lstrip('/')}"


@server.tool()
async def trace_health() -> dict[str, Any]:
    """Read health and database connectivity status from the running TRACE backend."""
    return await _request("GET", "/health", health=True)


@server.tool()
async def trace_current_user() -> dict[str, Any]:
    """Return the account associated with TRACE_ACCESS_TOKEN."""
    return await _request("GET", "/auth/me")


@server.tool()
async def trace_list_engagements() -> list[dict[str, Any]]:
    """List engagements visible to the authenticated TRACE account."""
    return await _request("GET", "/engagements/")


@server.tool()
async def trace_list_evidence(engagement_id: str) -> list[dict[str, Any]]:
    """List uploaded evidence and stored dataset profiles for an authorized engagement."""
    return await _request("GET", f"/uploads/{quote(engagement_id, safe='')}/uploads")


@server.tool()
async def trace_list_procedure_catalog() -> list[dict[str, Any]]:
    """List deterministic audit procedures available in the TRACE backend."""
    return await _request("GET", "/audit/checks/catalog")


@server.tool()
async def trace_list_procedure_runs(engagement_id: str) -> list[dict[str, Any]]:
    """List persisted procedure runs for an engagement visible to this account."""
    return await _request("GET", _engagement_path(engagement_id, "checks"))


@server.tool()
async def trace_list_findings(engagement_id: str) -> list[dict[str, Any]]:
    """List persisted findings for an authorized engagement."""
    return await _request("GET", _engagement_path(engagement_id, "findings"))


@server.tool()
async def trace_list_audit_events(engagement_id: str) -> list[dict[str, Any]]:
    """List audit events allowed by the account's event access grant."""
    return await _request("GET", _engagement_path(engagement_id, "audit-events"))


@server.tool()
async def trace_verify_audit_integrity(engagement_id: str) -> dict[str, Any]:
    """Verify an engagement's persisted event hash chain through the TRACE API."""
    return await _request("GET", _engagement_path(engagement_id, "audit-integrity"))


@server.tool()
async def trace_generate_report(engagement_id: str) -> dict[str, Any]:
    """Generate and persist a new report version from stored engagement data. This creates a report version and audit event."""
    return await _request("GET", _engagement_path(engagement_id, "report"))


@server.tool()
async def trace_run_procedure(engagement_id: str, procedure: str, version: str = "1.0") -> dict[str, Any]:
    """Execute and persist a backend audit procedure. This writes a procedure run and audit event."""
    if not procedure.strip():
        raise ValueError("procedure is required")
    return await _request("POST", _engagement_path(engagement_id, "checks"), body={"procedure": procedure, "version": version})


@server.tool()
async def trace_run_sampling(engagement_id: str, method: str = "random", size: int = 60) -> dict[str, Any]:
    """Create and persist a reproducible backend sample. This writes a sampling run and audit event."""
    if method not in {"random", "risk-based", "targeted"}:
        raise ValueError("method must be random, risk-based, or targeted")
    if not 1 <= size <= 10000:
        raise ValueError("size must be between 1 and 10000")
    return await _request("POST", _engagement_path(engagement_id, "sampling"), params={"method": method, "size": size})


if __name__ == "__main__":
    # MCP protocol traffic uses stdio. Never print to stdout here.
    server.run()
