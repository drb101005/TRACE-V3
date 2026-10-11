import os
import tempfile
import sys
from pathlib import Path

# Set an isolated database before backend.main creates its SQLAlchemy engine.
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="trace-test-"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["TRACE_DATA_DIR"] = str(_TEST_ROOT / "data")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_ROOT / 'trace-test.db'}"
os.environ["TRACE_BOOTSTRAP_ADMIN_EMAIL"] = ""
os.environ["TRACE_BOOTSTRAP_ADMIN_PASSWORD"] = ""

import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="session")
def client():
    from backend.main import app
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def registered_client(client):
    response = client.post("/api/v1/auth/register", json={
        "name": "Test Client", "email": "test-client@example.com", "password": "VerySafeTestPass123",
        "role": "client", "organization": "Test Company", "date_of_birth": "1985-01-01",
    })
    if response.status_code == 409:
        response = client.post("/api/v1/auth/login", json={"email": "test-client@example.com", "password": "VerySafeTestPass123"})
    assert response.status_code == 201 or response.status_code == 200
    return response.json()["access_token"]
