"""Pandas summaries and cross-dataset checks for uploaded statutory revenue data."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import pandas as pd

from .data_pipeline import DatasetError, load_dataframe

INVOICE_REQUIRED = {
    "invoice_id", "bill_no", "invoice_date", "job_no", "customer", "ledger_account_code", "gstin", "business_unit", "related_or_non_related", "total_taxable_value", "discount", "packing", "freight", "insurance", "tax_rate_percent", "igst", "cgst", "sgst", "tcs_collection", "round_off", "gross_invoice_amount", "e_invoice_status", "currency", "data_type", "audit_flag", "audit_issue_type", "audit_issue_detail",
}
LEDGER_REQUIRED = {"ledger_row_id", "ledger_account_code", "ledger_or_customer_name", "business_unit", "country", "source_system", "data_type"}
RELATED_REQUIRED = {"company_id", "company_name", "associated_business_unit", "relationship_type", "country", "data_type"}


def _norm(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _number(value: Any) -> Decimal | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip().replace(",", "").replace("₹", "").replace("INR", "")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _money(value: Decimal | None) -> float | None:
    return round(float(value), 2) if value is not None else None


def _file_kind(columns: set[str]) -> str | None:
    if INVOICE_REQUIRED <= columns:
        return "invoice"
    if LEDGER_REQUIRED <= columns:
        return "ledger"
    if RELATED_REQUIRED <= columns:
        return "related_companies"
    return None


def analyze_revenue_datasets(artifacts: list[Any]) -> dict[str, Any]:
    """Analyze actual stored uploads; no synthetic records or inferred joins are added."""
    datasets: dict[str, tuple[Any, pd.DataFrame]] = {}
    file_summaries: list[dict[str, Any]] = []
    for artifact in artifacts:
        try:
            df, source = load_dataframe(artifact.filename, Path(artifact.storage_path).read_bytes())
        except (OSError, DatasetError):
            continue
        kind = _file_kind(set(df.columns))
        file_summaries.append({"artifact_id": artifact.public_id, "filename": artifact.filename, "rows": len(df), "columns": len(df.columns), "recognized_as": kind or "tabular_dataset", "column_names": list(df.columns)})
        if kind:
            datasets[kind] = (artifact, df)

    issues: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    charts: list[dict[str, Any]] = []
    summary: dict[str, Any] = {"invoice_count": 0, "flagged_invoice_count": 0, "not_flagged_invoice_count": 0, "unclassified_audit_flag_count": 0, "taxable_total": None, "tax_total": None, "gross_total": None, "gross_totals_by_currency": {}, "taxable_totals_by_currency": {}, "tax_totals_by_currency": {}, "currency_count": 0, "business_unit_count": 0}
    source_flags: dict[str, Any] = {"flagged_count": 0, "not_flagged_count": 0, "unclassified_count": 0, "flagged_records": []}
    invoice_pair_count = 0
    if "invoice" in datasets:
        artifact, invoices = datasets["invoice"]
        invoice_pair_count = len(invoices)
        summary.update({"invoice_count": len(invoices), "source_artifact_id": artifact.public_id})
        # Source status is authoritative. This classification intentionally does not
        # infer a flag from any other field or from a computed audit check.
        flag_values = invoices.audit_flag.map(_norm)
        flagged_values = {"flag", "flagged"}
        not_flagged_values = {"not flag", "not flagged", "not_flag", "not_flagged"}
        is_flagged = flag_values.isin(flagged_values)
        is_not_flagged = flag_values.isin(not_flagged_values)
        source_flags = {"flagged_count": int(is_flagged.sum()), "not_flagged_count": int(is_not_flagged.sum()), "unclassified_count": int((~(is_flagged | is_not_flagged)).sum()), "flagged_records": []}
        for i in invoices.index[is_flagged].tolist()[:100]:
            row = invoices.iloc[i]
            source_flags["flagged_records"].append({"invoice_id": str(row.invoice_id), "bill_no": str(row.bill_no), "audit_flag": str(row.audit_flag), "audit_issue_type": str(row.audit_issue_type), "audit_issue_detail": str(row.audit_issue_detail)})
        summary.update({"flagged_invoice_count": source_flags["flagged_count"], "not_flagged_invoice_count": source_flags["not_flagged_count"], "unclassified_audit_flag_count": source_flags["unclassified_count"]})
        summary["currency_count"] = int(invoices.currency.replace("", pd.NA).nunique())
        summary["business_unit_count"] = int(invoices.business_unit.replace("", pd.NA).nunique())
        for col, target in (("gross_invoice_amount", "gross_totals_by_currency"), ("total_taxable_value", "taxable_totals_by_currency")):
            totals: dict[str, Decimal] = {}
            for currency, value in zip(invoices.currency, invoices[col]):
                amount = _number(value)
                key = str(currency).strip() or "Unspecified currency"
                if amount is not None:
                    totals[key] = totals.get(key, Decimal(0)) + amount
            summary[target] = {key: _money(value) for key, value in totals.items()}
        tax_totals: dict[str, Decimal] = {}
        for _, row in invoices.iterrows():
            currency = str(row.currency).strip() or "Unspecified currency"
            tax_totals[currency] = tax_totals.get(currency, Decimal(0)) + sum((_number(row[col]) or Decimal(0) for col in ("igst", "cgst", "sgst", "tcs_collection")), Decimal(0))
        summary["tax_totals_by_currency"] = {key: _money(value) for key, value in tax_totals.items()}
        if summary["currency_count"] <= 1:
            only_gross = next(iter(summary["gross_totals_by_currency"].values()), 0)
            only_taxable = next(iter(summary["taxable_totals_by_currency"].values()), 0)
            only_tax = next(iter(summary["tax_totals_by_currency"].values()), 0)
            summary.update({"gross_total": only_gross, "taxable_total": only_taxable, "tax_total": only_tax})

        def add_issue(code: str, message: str, indices: list[int], examples: list[dict[str, Any]], amount: Decimal | None = None):
            if not indices:
                return
            counts[code] = len(indices)
            issues.append({"code": code, "label": message, "count": len(indices), "amount": _money(amount), "examples": examples[:8]})

        def examples_for(indices: list[int]) -> list[dict[str, Any]]:
            result = []
            for i in indices[:8]:
                row = invoices.iloc[i]
                result.append({"invoice_id": str(row.get("invoice_id", "")), "bill_no": str(row.get("bill_no", "")), "invoice_date": str(row.get("invoice_date", "")), "business_unit": str(row.get("business_unit", "")), "gross_invoice_amount": str(row.get("gross_invoice_amount", ""))})
            return result

        for column, code in (("invoice_id", "missing_invoice_id"), ("bill_no", "missing_bill_no"), ("invoice_date", "missing_invoice_date"), ("gstin", "missing_gstin")):
            indices = [i for i, value in enumerate(invoices[column]) if not _norm(value)]
            add_issue(code, f"Missing {column.replace('_', ' ')}", indices, examples_for(indices))
        for column, code in (("invoice_id", "duplicate_invoice_id"), ("bill_no", "duplicate_bill_no")):
            duplicate = invoices[column].astype("string").str.strip().replace("", pd.NA).duplicated(keep=False)
            indices = [i for i, value in enumerate(duplicate.tolist()) if value]
            add_issue(code, f"Duplicate {column.replace('_', ' ')}", indices, examples_for(indices))

        arithmetic_indices: list[int] = []
        arithmetic_amount = Decimal(0)
        tax_rate_indices: list[int] = []
        tax_rate_amount = Decimal(0)
        for i, row in invoices.iterrows():
            vals = {column: _number(row[column]) for column in ("total_taxable_value", "discount", "packing", "freight", "insurance", "igst", "cgst", "sgst", "tcs_collection", "round_off", "gross_invoice_amount")}
            required = ("total_taxable_value", "gross_invoice_amount")
            if all(vals[k] is not None for k in required):
                expected = vals["total_taxable_value"] - (vals["discount"] or Decimal(0)) + sum((vals[k] or Decimal(0) for k in ("packing", "freight", "insurance", "igst", "cgst", "sgst", "tcs_collection", "round_off")), Decimal(0))
                delta = abs(expected - vals["gross_invoice_amount"])
                if delta > Decimal("1.00"):
                    arithmetic_indices.append(i)
                    arithmetic_amount += delta
            rate = _number(row["tax_rate_percent"])
            tax_values = [vals[k] for k in ("igst", "cgst", "sgst")]
            if rate is not None and vals["total_taxable_value"] is not None and all(x is not None for x in tax_values):
                expected_tax = vals["total_taxable_value"] * rate / Decimal(100)
                tax_delta = abs(expected_tax - sum(tax_values, Decimal(0)))
                if tax_delta > Decimal("1.00"):
                    tax_rate_indices.append(i)
                    tax_rate_amount += tax_delta
        add_issue("invoice_arithmetic_mismatch", "Invoice total does not reconcile to taxable value, adjustments, and taxes (tolerance 1 currency unit)", arithmetic_indices, examples_for(arithmetic_indices), arithmetic_amount)
        add_issue("tax_rate_mismatch", "Tax components do not reconcile to taxable value and stated tax rate (tolerance 1 currency unit)", tax_rate_indices, examples_for(tax_rate_indices), tax_rate_amount)

        invoice_dates = pd.to_datetime(invoices.invoice_date, errors="coerce", format="mixed")
        invalid_date_indices = [i for i, value in enumerate(invoice_dates.isna().tolist()) if value]
        add_issue("invalid_invoice_date", "Invoice date is blank or invalid", invalid_date_indices, examples_for(invalid_date_indices))

        months = invoice_dates.dt.to_period("M").astype("string")
        monthly = pd.DataFrame({"month": months, "currency": invoices.currency.replace("", "Unspecified"), "gross": [_number(v) for v in invoices.gross_invoice_amount]}).dropna()
        if len(monthly):
            monthly["gross"] = monthly.gross.map(float)
            points = monthly.groupby(["month", "currency"], as_index=False).gross.sum().sort_values(["currency", "month"])
            charts.append({"id": "monthly_gross", "title": "Gross invoice amount by month and currency", "type": "bar", "unit": "currency", "data": [{"label": f"{r.month} · {r.currency}", "value": round(float(r.gross), 2)} for r in points.itertuples()]})
        bu = pd.DataFrame({"business_unit": invoices.business_unit.map(lambda x: str(x).strip() or "Unspecified"), "currency": invoices.currency.replace("", "Unspecified"), "gross": [_number(v) for v in invoices.gross_invoice_amount]}).dropna()
        if len(bu):
            bu["gross"] = bu.gross.map(float)
            points = bu.groupby(["business_unit", "currency"], as_index=False).gross.sum().sort_values("gross", ascending=False).head(12)
            charts.append({"id": "gross_by_business_unit", "title": "Gross amount by business unit and currency", "type": "bar", "unit": "currency", "data": [{"label": f"{r.business_unit} · {r.currency}", "value": round(float(r.gross), 2)} for r in points.itertuples()]})
        related_breakdown = invoices.related_or_non_related.map(lambda x: str(x).strip() or "Unspecified").value_counts().to_dict()
        charts.append({"id": "related_party_split", "title": "Related party classification", "type": "pie", "unit": "invoices", "data": [{"label": str(label), "value": int(value)} for label, value in related_breakdown.items()]})
        charts.append({"id": "audit_flag_status", "title": "Source Audit_Flag status", "type": "pie", "unit": "invoices", "data": [{"label": "Flag", "value": source_flags["flagged_count"]}, {"label": "Not flag", "value": source_flags["not_flagged_count"]}, {"label": "Unclassified", "value": source_flags["unclassified_count"]}]})
        if "ledger" in datasets:
            ledger_artifact, ledger = datasets["ledger"]
            ledger_codes = {_norm(x) for x in ledger.ledger_account_code if _norm(x)}
            unknown = [i for i, value in enumerate(invoices.ledger_account_code) if _norm(value) and _norm(value) not in ledger_codes]
            add_issue("unmapped_ledger_account", "Invoice ledger account code is absent from the uploaded ledger reference", unknown, examples_for(unknown))
            summary["ledger_reference_artifact_id"] = ledger_artifact.public_id
            summary["ledger_match_count"] = len(invoices) - len(unknown)
        if "related_companies" in datasets:
            related_artifact, related = datasets["related_companies"]
            company_names = {_norm(x) for x in related.company_name if _norm(x)}
            marked_related = invoices.related_or_non_related.astype("string").str.casefold().str.contains("related", na=False) & ~invoices.related_or_non_related.astype("string").str.casefold().str.contains("non", na=False)
            expected_related = [i for i, value in enumerate(marked_related.tolist()) if value and _norm(invoices.iloc[i].customer) not in company_names]
            add_issue("related_party_not_in_reference", "Invoice marked related but customer is not in the uploaded related-company reference", expected_related, examples_for(expected_related))
            summary["related_reference_artifact_id"] = related_artifact.public_id
            summary["related_company_count"] = len(related)
    else:
        issues.append({"code": "invoice_dataset_missing", "label": "Upload a dataset containing the specified invoice columns to run invoice analysis", "count": 0, "amount": None, "examples": []})

    counts.setdefault("unmapped_ledger_account", 0)
    counts.setdefault("related_party_not_in_reference", 0)
    charts.append({"id": "issues_by_type", "title": "Discrepancies by type", "type": "pie", "unit": "rows", "data": [{"label": next(x["label"] for x in issues if x["code"] == code), "value": count} for code, count in counts.items() if count > 0]})
    return {"method": "pandas deterministic profiling and reconciliation", "analysis_version": "revenue-v1", "summary": summary, "source_audit_flags": source_flags, "discrepancy_count": sum(x["count"] for x in issues), "discrepancy_types": len([x for x in issues if x["count"]]), "discrepancies": issues, "charts": charts, "datasets": file_summaries, "limitations": ["Only uploaded tabular files with recognized column headers are analyzed.", "Audit_Flag classification uses only that source column; unrecognized or blank values are shown as unclassified.", "Invoice arithmetic assumes discount reduces the taxable value and round-off is an additive adjustment; confirm the company’s convention.", "Related-company matching uses normalized Customer and Company_Name text; unmatched names require human review.", "A matching ledger account code does not confirm posting accuracy." ]}
