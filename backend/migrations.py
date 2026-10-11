"""Small versioned schema migrations for the SQLite deployment."""
import re
from datetime import datetime, timezone

from sqlalchemy import inspect, select, text

from .database import engine
from .models import Company

MIGRATION_VERSION = 6

def _normalized_company(name: str, fallback: str) -> tuple[str, str]:
    display = " ".join((name or "").split()).strip() or fallback
    normalized = re.sub(r"\s+", " ", display.casefold()).strip()
    return display, normalized

def migrate():
    """Apply versioned schema and access-policy changes while preserving workflow rows."""
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(40) NOT NULL)"))
        applied = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}
        if 1 not in applied:
            Company.__table__.create(bind=conn, checkfirst=True)
            inspector = inspect(conn)
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            engagement_columns = {column["name"] for column in inspector.get_columns("engagements")}
            if "company_id" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id)"))
            if "company_id" not in engagement_columns:
                conn.execute(text("ALTER TABLE engagements ADD COLUMN company_id INTEGER REFERENCES companies(id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_company_id ON users (company_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_engagements_company_id ON engagements (company_id)"))

        users = conn.execute(text("SELECT id, name, organization, role, company_id FROM users")).mappings().all()
        engagements = conn.execute(text("SELECT id, organization, client_id, company_id FROM engagements")).mappings().all()

        def company_id_for(label: str, fallback: str, *, reuse: bool = True) -> int:
            display, normalized = _normalized_company(label, fallback)
            if reuse:
                existing = conn.execute(select(Company.id).where(Company.normalized_name == normalized)).scalar_one_or_none()
                if existing is not None: return existing
            else:
                normalized = f"{normalized[:210]}#legacy-user-{fallback.rsplit(' ', 1)[-1]}"
            result = conn.execute(Company.__table__.insert().values(legal_name=display, normalized_name=normalized, active=True, created_at=datetime.now(timezone.utc)))
            return result.inserted_primary_key[0]

        user_company: dict[int, int] = {}
        for user in users:
            if user["company_id"] is not None:
                user_company[user["id"]] = user["company_id"]
            elif user["role"] == "client":
                tenant_id = company_id_for(user["organization"], f"Legacy client {user['id']}", reuse=False)
                user_company[user["id"]] = tenant_id
                conn.execute(text("UPDATE users SET company_id=:company_id WHERE id=:id"), {"company_id": tenant_id, "id": user["id"]})

        for engagement in engagements:
            if engagement["company_id"] is not None:
                continue
            tenant_id = user_company.get(engagement["client_id"])
            if tenant_id is None:
                tenant_id = company_id_for(engagement["organization"], f"Legacy engagement {engagement['id']}")
            conn.execute(text("UPDATE engagements SET company_id=:company_id WHERE id=:id"), {"company_id": tenant_id, "id": engagement["id"]})

        if 1 not in applied:
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (1, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
            applied.add(1)

        if 2 not in applied:
            user_columns = {column["name"] for column in inspect(conn).get_columns("users")}
            if "token_version" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))
            if "last_login_at" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (2, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
            applied.add(2)

        if 3 not in applied:
            snapshot_columns = {column["name"] for column in inspect(conn).get_columns("audit_snapshots")}
            if "parent_snapshot_id" not in snapshot_columns:
                conn.execute(text("ALTER TABLE audit_snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES audit_snapshots(id)"))
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (3, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
            applied.add(3)

        if 4 not in applied:
            request_columns = {column["name"] for column in inspect(conn).get_columns("evidence_requests")}
            additions = {
                "due_date": "DATE",
                "response_note": "TEXT NOT NULL DEFAULT ''",
                "artifact_public_id": "VARCHAR(40)",
                "updated_at": "DATETIME",
            }
            for column, declaration in additions.items():
                if column not in request_columns:
                    conn.execute(text(f"ALTER TABLE evidence_requests ADD COLUMN {column} {declaration}"))
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (4, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
            applied.add(4)

        if 5 not in applied:
            user_columns = {column["name"] for column in inspect(conn).get_columns("users")}
            if "google_subject" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN google_subject VARCHAR(255)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_subject ON users (google_subject)"))
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (5, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
            applied.add(5)

        if 6 not in applied:
            user_columns = {column["name"] for column in inspect(conn).get_columns("users")}
            if "password_hash" in user_columns:
                conn.execute(text("ALTER TABLE users DROP COLUMN password_hash"))
            # There is no password-login throttling table once Google is the sole auth provider.
            conn.execute(text("DROP TABLE IF EXISTS login_attempts"))
            # Require explicit admin approval for pre-existing accounts and revoke their old sessions.
            conn.execute(text("UPDATE users SET active=CASE WHEN lower(email)='drb.genai@gmail.com' THEN active ELSE 0 END, token_version=token_version+1"))
            # Only the designated Google identity may hold platform administrator privileges.
            conn.execute(text("UPDATE users SET role='auditor' WHERE role='admin' AND lower(email) <> 'drb.genai@gmail.com'"))
            conn.execute(text("INSERT INTO schema_migrations(version, applied_at) VALUES (6, :applied_at)"), {"applied_at": datetime.now(timezone.utc).isoformat()})
