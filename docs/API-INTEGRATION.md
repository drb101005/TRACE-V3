# Frontend/API integration

The React workspace in `frontend/` uses `frontend/src/api.js` for bearer-token requests. In development, Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`. In deployment, `VITE_API_BASE_URL` points the browser to the FastAPI service.

All account, company, engagement, artifact, procedure, sampling, finding, report, and audit-event records shown in the authenticated workspace are loaded from FastAPI endpoints backed by the database. The frontend contains no seeded users, engagements, findings, transactions, files, activity entries, dashboard metrics, or report contents. Empty database results render as empty states.

Connected routes include:

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, and `GET /api/v1/auth/me` for password-based identity and session validation.
- `GET/POST /api/v1/engagements/` for engagement lists and client creation.
- `GET /api/v1/engagements/{id}/progress` for the client-facing engagement checklist. It derives stages from saved assignments, uploaded artifacts, audit procedure runs, finding decisions, evidence request statuses, and report versions; a report is marked as needing refresh when newer evidence or procedure results exist.
- `GET /api/v1/engagements/{id}/access`, `POST /api/v1/engagements/{id}/assign`, and `PUT /api/v1/engagements/{id}/access` for auditor and per-file access choices. When a client provides `allowed_artifact_ids`, only those uploaded files are visible to the assigned auditor; the same scope applies to file downloads and file-backed analysis.
- `/api/v1/uploads/{engagement_id}/...` for evidence upload, list, validation, and download.
- `/api/v1/audit/checks/catalog` and engagement audit routes for checks, findings, sampling, reports, snapshots, scans, and event integrity.
- `/api/v1/admin/users`, `/api/v1/admin/companies`, `/api/v1/admin/audit-logs`, and `/api/v1/health` for administrative records and service status.

The API is the source of truth for roles and permissions. The frontend does not use local fallback records when a request fails; it displays the API error or an empty state. Backend setup and permission rules are documented in [BACKEND.md](BACKEND.md).

## Revenue report analysis

Clicking **Generate report** calls `GET /api/v1/audit/{engagement_id}/report`. The endpoint reads tabular artifacts stored for that engagement, profiles them with pandas, includes the analysis in `revenue_analysis`, and persists the report version and hash. The reports screen plots the API-provided `charts` series with D3; it does not calculate or seed chart data in the browser.

Recognized table types are selected by normalized column headers:

- Invoice table: `Invoice_ID`, `Bill_No`, `Invoice_Date`, `Job_No`, `Customer`, `Ledger_Account_Code`, `GSTIN`, `Business_Unit`, `Related_or_Non_Related`, `Total_Taxable_Value`, `Discount`, `Packing`, `Freight`, `Insurance`, `Tax_Rate_Percent`, `IGST`, `CGST`, `SGST`, `TCS_Collection`, `Round_Off`, `Gross_Invoice_Amount`, `E_Invoice_Status`, `Currency`, `Data_Type`, `Audit_Flag`, `Audit_Issue_Type`, and `Audit_Issue_Detail`.
- Ledger reference: `Ledger_Row_ID`, `Ledger_Account_Code`, `Ledger_or_Customer_Name`, `Business_Unit`, `Country`, `Source_System`, and `Data_Type`.
- Related-company reference: `Company_ID`, `Company_Name`, `Associated_Business_Unit`, `Relationship_Type`, `Country`, and `Data_Type`.

The `Flag`/`Not flag` status and source-flag chart are derived only from `Audit_Flag`; they are not inferred from other fields or calculated checks. Blank or unrecognized source values are reported as unclassified. Separately, the report checks missing and duplicate invoice IDs/bill numbers, invalid invoice dates, gross arithmetic differences, stated tax-rate differences, invoice ledger codes absent from the ledger reference, and related-party labels whose customer name is absent from the related-company reference. These checks are shown as review signals and do not alter `Audit_Flag`. Amount totals are split by `Currency`; amounts across different currencies are not added together. It also returns uploaded-file summaries, discrepancy examples, and chart series for gross invoice amount by month, gross amount by business unit, related-party classification, source flag status, and issue type.

The gross arithmetic check assumes `Gross_Invoice_Amount = Total_Taxable_Value - Discount + Packing + Freight + Insurance + IGST + CGST + SGST + TCS_Collection + Round_Off`, with a one-unit tolerance in the source currency. Tax-rate reconciliation compares `Total_Taxable_Value × Tax_Rate_Percent` with IGST + CGST + SGST, also with a one-unit tolerance. Confirm those conventions against the source accounting system. Related-company matching uses normalized text from `Customer` and `Company_Name`, so unmatched names are review signals, not conclusions. The report is deterministic and requires human review; it is not an audit opinion. PDFs and Word documents remain stored evidence and are not parsed by this table analysis.

## Complete report download

The Reports screen's **Download complete report (.zip)** action packages the generated report JSON, the report HTML, the current D3 chart SVGs, and the engagement workpaper CSV. The HTML can be opened in a browser or printed to PDF. The CSV is fetched from the API's permission-checked export endpoint; auditors need the transaction export grant in addition to the report grant.
