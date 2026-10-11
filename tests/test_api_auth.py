def test_google_only_sessions_and_engagement_permissions(client, user_factory):
    owner = user_factory("owner@gmail.com", "client", "Test Company")
    headers = {"Authorization": f"Bearer {owner['token']}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    engagement = client.post("/api/v1/engagements/", headers=headers, json={"name":"FY26 Revenue Review", "organization":"Ignored by server", "period":"FY2026", "scope":"Revenue", "required_records":[]})
    assert engagement.status_code == 201
    other = user_factory("other@gmail.com", "client", "Other Company")
    other_headers = {"Authorization": f"Bearer {other['token']}"}
    assert client.get(f"/api/v1/engagements/{engagement.json()['id']}", headers=other_headers).status_code == 404
    auditor = user_factory("auditor@gmail.com", "auditor", "Audit Firm")
    audit_headers = {"Authorization": f"Bearer {auditor['token']}"}
    assignment = client.post(f"/api/v1/engagements/{engagement.json()['id']}/assign", headers=headers, json={"auditor_id":auditor["id"], "allowed_fields":["documents", "checks", "report", "sampling", "findings", "events", "transactions"]})
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
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

def test_password_and_self_registration_routes_are_removed(client):
    assert client.post("/api/v1/auth/register", json={}).status_code == 404
    assert client.post("/api/v1/auth/login", json={}).status_code == 404
    assert client.post("/api/v1/auth/password", json={}).status_code == 404

def test_rejects_expired_or_invalid_token(client):
    assert client.get("/api/v1/auth/me", headers={"Authorization":"Bearer garbage"}).status_code == 401
