import os
import tempfile
import sys
from pathlib import Path

# Set an isolated database before backend.main creates its SQLAlchemy engine.
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="trace-test-"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["TRACE_DATA_DIR"] = str(_TEST_ROOT / "data")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_ROOT / 'trace-test.db'}"

import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="session")
def client():
    from backend.main import app
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def user_factory():
    def create(email, role="client", organization="Test Company"):
        from backend.database import SessionLocal
        from backend.main import issue_token, normalized_name
        from backend.models import Company, User
        with SessionLocal() as db:
            company = None
            if role == "client":
                company = Company(legal_name=organization, normalized_name=f"{normalized_name(organization)}-{email.split('@')[0]}")
                db.add(company)
                db.flush()
            user = User(email=email, name=email.split("@", 1)[0], role=role, organization=organization, company_id=company.id if company else None)
            db.add(user)
            db.commit()
            db.refresh(user)
            return {"id": user.id, "token": issue_token(user)}
    return create
