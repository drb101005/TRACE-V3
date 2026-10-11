from datetime import date, timedelta

def test_registration_login_and_revocation(client, registered_client):
    headers = {"Authorization": f"Bearer {registered_client}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    engagement = client.post("/api/v1/engagements/", headers=headers, json={"name":"FY26 Revenue Review", "organization":"Ignored by server", "period":"FY2026", "scope":"Revenue", "required_records":[]})
    assert engagement.status_code == 201
    other = client.post("/api/v1/auth/register", json={"name":"Other Client", "email":"other-client@example.com", "password":"AnotherSafePass123", "role":"client", "organization":"Test Company", "date_of_birth":"1985-01-01"})
    assert other.status_code == 201
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(f"/api/v1/engagements/{engagement.json()['id']}", headers=other_headers).status_code == 404
    auditor = client.post("/api/v1/auth/register", json={"name":"Test Auditor", "email":"auditor@example.com", "password":"AuditorSafePass123", "role":"auditor", "organization":"Audit Firm", "date_of_birth":"1980-01-01"})
    assert auditor.status_code == 201
    audit_headers = {"Authorization": f"Bearer {auditor.json()['access_token']}"}
    assignment = client.post(f"/api/v1/engagements/{engagement.json()['id']}/assign", headers=headers, json={"auditor_id":auditor.json()["user"]["id"], "allowed_fields":["documents", "checks", "report", "sampling", "findings", "events", "transactions"]})
    assert assignment.status_code == 200
    upload = client.post(f"/api/v1/uploads/{engagement.json()['id']}/upload", headers=headers, files={"file":("sales.csv", b"Invoice No,Amount\n0001,100\n0002,-5\n", "text/csv")})
    assert upload.status_code == 201
    first_snapshot = client.post(f"/api/v1/audit/{engagement.json()['id']}/snapshots", headers=headers)
    assert first_snapshot.status_code == 201
    check = client.post(f"/api/v1/audit/{engagement.json()['id']}/checks", headers=audit_headers, json={"procedure":"financial check", "version":"1.0"})
    assert check.status_code == 201
    assert check.json()["results"][0]["exception_count"] == 1
    sampling = client.post(f"/api/v1/audit/{engagement.json()['id']}/sampling?method=risk-based&size=30", headers=audit_headers)
    assert sampling.status_code == 201 and sampling.json()["sample_size"] == 2
    evidence_request = client.post(f"/api/v1/audit/{engagement.json()['id']}/evidence-requests", headers=audit_headers, json={"description":"Provide the signed invoice for invoice 0002", "due_date":"2026-12-01"})
    assert evidence_request.status_code == 201
    submitted = client.patch(f"/api/v1/audit/{engagement.json()['id']}/evidence-requests/{evidence_request.json()['id']}", headers=headers, json={"status":"submitted", "note":"Uploaded the signed invoice", "artifact_id":upload.json()["id"]})
    assert submitted.status_code == 200 and submitted.json()["status"] == "submitted"
    decided = client.patch(f"/api/v1/audit/{engagement.json()['id']}/evidence-requests/{evidence_request.json()['id']}", headers=audit_headers, json={"status":"accepted", "note":"Evidence reviewed"})
    assert decided.status_code == 200 and decided.json()["status"] == "accepted"
    report = client.get(f"/api/v1/audit/{engagement.json()['id']}/report", headers=audit_headers)
    assert report.status_code == 200 and report.json()["report_version"] == 1
    assert client.get(f"/api/v1/audit/{engagement.json()['id']}/report/versions", headers=audit_headers).json()[0]["report_hash"]
    assert client.get(f"/api/v1/audit/{engagement.json()['id']}/audit-integrity", headers=audit_headers).json()["valid"] is True
    revised = client.post(f"/api/v1/uploads/{engagement.json()['id']}/upload", headers=headers, files={"file":("sales-revised.csv", b"Invoice No,Amount\n0001,100\n0002,5\n0003,40\n", "text/csv")})
    assert revised.status_code == 201
    scan = client.post(f"/api/v1/audit/{engagement.json()['id']}/scan?key_column=invoice_no", headers=headers)
    assert scan.status_code == 200
    assert scan.json()["added_rows"] == 1 and scan.json()["changed_rows"] == 1
    assert scan.json()["resolved_exception_count"] == 1 and scan.json()["report_version"] == 2
    assert client.put(f"/api/v1/engagements/{engagement.json()['id']}/access", headers=headers, json={"allowed_fields":["documents", "report", "sampling", "findings", "events", "transactions"]}).status_code == 200
    assert client.post(f"/api/v1/audit/{engagement.json()['id']}/checks", headers=audit_headers, json={"procedure":"financial check", "version":"1.0"}).status_code == 403
    assert client.post("/api/v1/auth/login", json={"email": "test-client@example.com", "password": "wrong-password"}).status_code == 401
    changed = client.post("/api/v1/auth/password", headers=headers, json={"current_password": "VerySafeTestPass123", "new_password": "NewSafePassphrase456"})
    assert changed.status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401

def test_public_registration_cannot_set_admin(client):
    response = client.post("/api/v1/auth/register", json={"name":"Bad Role", "email":"admin-role@example.test", "password":"VerySafeTestPass123", "role":"admin", "organization":"X", "date_of_birth":"1985-01-01"})
    assert response.status_code == 422

def test_rejects_expired_or_invalid_token(client):
    assert client.get("/api/v1/auth/me", headers={"Authorization":"Bearer garbage"}).status_code == 401
