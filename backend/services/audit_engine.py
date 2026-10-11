"""Deterministic, explainable audit rules. Outputs are exception signals, not conclusions."""
from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd

from .data_pipeline import _as_decimal, _record_reference

CHECKS = {
    "missing_invoice_id": {"name": "Missing invoice identifiers", "objective": "Identify sales records without an invoice identifier."},
    "duplicate_invoice": {"name": "Duplicate invoice identifiers", "objective": "Identify repeated invoice identifiers for human investigation."},
    "negative_amount": {"name": "Negative monetary values", "objective": "Identify negative monetary values for credit-note/reversal review."},
    "invoice_arithmetic": {"name": "Invoice arithmetic", "objective": "Compare taxable amount plus tax with the supplied invoice total."},
    "out_of_period": {"name": "Transactions outside audit period", "objective": "Identify transaction dates outside the configured period."},
    "duplicate_rows": {"name": "Duplicate transaction rows", "objective": "Identify exact repeated rows while retaining source data."},
    "missing_values": {"name": "Required-field completeness", "objective": "Identify missing values in explicitly selected fields."},
}

def _find_column(columns: list[str], patterns: tuple[str, ...]) -> str | None:
    for column in columns:
        if any(re.search(pattern, column) for pattern in patterns):
            return column
    return None

def _references(df: pd.DataFrame, positions: list[int], columns: list[str]) -> list[dict[str, Any]]:
    return [_record_reference(df.iloc[pos], pos + 2, columns) for pos in positions[:100]]

def _base(check_id: str, source_artifact_id: str, row_count: int, params: dict[str, Any]) -> dict[str, Any]:
    definition = CHECKS[check_id]
    return {"check_id": check_id, "check_name": definition["name"], "objective": definition["objective"], "rule_version": "1.0", "source_artifact_id": source_artifact_id, "population_count": row_count, "parameters": params}

def execute_check(check_id: str, df: pd.DataFrame, *, source_artifact_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if check_id not in CHECKS:
        raise ValueError(f"Unknown check_id: {check_id}")
    params = params or {}
    columns = list(df.columns)
    result = _base(check_id, source_artifact_id, len(df), params)
    positions: list[int] = []
    evidence: dict[str, Any] = {}

    if check_id == "missing_invoice_id":
        column = _find_column(columns, (r"invoice.*(id|no|number)", r"^(invoice|inv)$"))
        if not column:
            return {**result, "status": "BLOCKED", "reason": "No invoice identifier column could be mapped."}
        positions = [i for i, value in enumerate(df[column].tolist()) if pd.isna(value) or not str(value).strip()]
        evidence["identifier_column"] = column
    elif check_id == "duplicate_invoice":
        column = _find_column(columns, (r"invoice.*(id|no|number)", r"^(invoice|inv)$"))
        if not column:
            return {**result, "status": "BLOCKED", "reason": "No invoice identifier column could be mapped."}
        values = df[column].astype("string").str.strip()
        duplicate_mask = values.ne("") & values.duplicated(keep=False)
        positions = np.flatnonzero(duplicate_mask.fillna(False).to_numpy()).tolist()
        evidence["identifier_column"] = column
    elif check_id == "negative_amount":
        monetary_columns = [c for c in columns if re.search(r"amount|revenue|sales|taxable|tax|total|value|debit|credit", c)]
        if not monetary_columns:
            return {**result, "status": "BLOCKED", "reason": "No monetary column has been mapped."}
        for i, (_, row) in enumerate(df.iterrows()):
            for column in monetary_columns:
                value = _as_decimal(row[column])
                if value is not None and value < Decimal("0"):
                    positions.append(i)
                    break
        evidence["monetary_columns"] = monetary_columns
    elif check_id == "invoice_arithmetic":
        taxable = _find_column(columns, (r"taxable.*(amount|value)?", r"net.*amount", r"base.*amount"))
        tax = _find_column(columns, (r"^tax$", r"tax_amount", r"gst", r"vat"))
        total = _find_column(columns, (r"invoice_total", r"grand_total", r"total_amount", r"gross_amount", r"^total$"))
        if not all((taxable, tax, total)):
            return {**result, "status": "BLOCKED", "reason": "Taxable amount, tax, and invoice total columns must be mapped."}
        tolerance = Decimal(str(params.get("tolerance", "0.01")))
        for i, (_, row) in enumerate(df.iterrows()):
            amounts = [_as_decimal(row[c]) for c in (taxable, tax, total)]
            if all(value is not None for value in amounts) and abs((amounts[0] + amounts[1]) - amounts[2]) > tolerance:
                positions.append(i)
        evidence.update({"taxable_column": taxable, "tax_column": tax, "total_column": total, "tolerance": str(tolerance)})
    elif check_id == "out_of_period":
        column = _find_column(columns, (r"invoice_date", r"transaction_date", r"posting_date", r"^date$"))
        start, end = params.get("period_start"), params.get("period_end")
        if not column or not start or not end:
            return {**result, "status": "BLOCKED", "reason": "A transaction date column and period_start/period_end are required."}
        parsed = pd.to_datetime(df[column], errors="coerce", format="mixed")
        lower, upper = pd.Timestamp(start), pd.Timestamp(end)
        positions = np.flatnonzero((parsed.notna() & ((parsed < lower) | (parsed > upper))).to_numpy()).tolist()
        evidence.update({"date_column": column, "period_start": start, "period_end": end, "invalid_date_count": int(parsed.isna().sum())})
    elif check_id == "duplicate_rows":
        positions = np.flatnonzero(df.duplicated(keep=False).to_numpy()).tolist()
    elif check_id == "missing_values":
        selected = params.get("columns") or columns
        unknown = sorted(set(selected) - set(columns))
        if unknown:
            return {**result, "status": "BLOCKED", "reason": f"Unknown columns: {', '.join(unknown)}"}
        for i, (_, row) in enumerate(df[selected].iterrows()):
            if any(pd.isna(value) or not str(value).strip() for value in row.tolist()):
                positions.append(i)
        evidence["columns"] = selected

    result.update({"status": "EXCEPTION" if positions else "PASS", "exception_count": len(positions), "source_record_references": _references(df, positions, columns), "evidence": evidence, "result_summary": f"{len(positions)} record(s) require review." if positions else "No exceptions were identified by this rule."})
    return result

def run_checks(df: pd.DataFrame, *, source_artifact_id: str, period_start: str | None = None, period_end: str | None = None) -> list[dict[str, Any]]:
    results = []
    for check_id in ("missing_invoice_id", "duplicate_invoice", "negative_amount", "invoice_arithmetic", "duplicate_rows"):
        params = {"tolerance": "0.01"}
        if check_id == "out_of_period":
            params.update({"period_start": period_start, "period_end": period_end})
        results.append(execute_check(check_id, df, source_artifact_id=source_artifact_id, params=params))
    if period_start or period_end:
        results.append(execute_check("out_of_period", df, source_artifact_id=source_artifact_id, params={"period_start": period_start, "period_end": period_end}))
    return results

def risk_indicators(df: pd.DataFrame) -> dict[str, Any]:
    columns = list(df.columns)
    money_columns = [c for c in columns if re.search(r"amount|revenue|sales|taxable|total|value", c)]
    indicators: list[dict[str, Any]] = []
    for column in money_columns:
        values = pd.to_numeric(df[column].astype("string").str.replace(r"[₹,]", "", regex=True), errors="coerce").dropna()
        if len(values) < 4:
            continue
        q1, q3 = float(values.quantile(.25)), float(values.quantile(.75))
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        for position, value in enumerate(pd.to_numeric(df[column].astype("string").str.replace(r"[₹,]", "", regex=True), errors="coerce").tolist()):
            if value is not None and not pd.isna(value) and (value < lower or value > upper):
                indicators.append({"anomaly_type": "iqr_outlier", "column": column, "source_record_reference": _record_reference(df.iloc[position], position + 2, columns), "value": str(value), "lower_bound": lower, "upper_bound": upper, "method": "IQR 1.5x", "severity": "review", "explanation": "Value falls outside the configured interquartile range; this is a review indicator, not evidence of misstatement."})
    return {"method_version": "trace-risk-1.0", "anomalies": indicators[:1000], "anomaly_count": len(indicators), "human_review_required": True}

def deterministic_sample(df: pd.DataFrame, *, source_fingerprint: str, size: int, seed: str = "trace-default-v1", key_column: str | None = None, strategy: str = "random") -> dict[str, Any]:
    if size < 1:
        raise ValueError("Sample size must be positive")
    if key_column and key_column not in df.columns:
        raise ValueError("Sampling key column is not present in the population")
    if strategy not in {"random", "risk-based", "targeted"}:
        raise ValueError("Unsupported sampling strategy")
    columns = list(df.columns)
    ranking = []
    for index, (_, row) in enumerate(df.iterrows()):
        stable_key = str(row[key_column]) if key_column and str(row[key_column]).strip() else json.dumps(row.to_dict(), default=str, sort_keys=True)
        digest = hashlib.sha256(f"{seed}:{source_fingerprint}:{stable_key}:{index}".encode()).hexdigest()
        monetary = [_as_decimal(row[c]) for c in columns if re.search(r"amount|revenue|sales|tax|total|value", c)]
        numeric_risk = max((abs(value) for value in monetary if value is not None), default=Decimal("0"))
        has_negative = any(value is not None and value < 0 for value in monetary)
        priority = (-int(has_negative), -numeric_risk) if strategy == "targeted" else (-numeric_risk,) if strategy == "risk-based" else ()
        ranking.append((priority, digest, index, row))
    selected = sorted(ranking)[:min(size, len(ranking))]
    refs = [_record_reference(row, index + 2, columns) for _, _, index, row in selected]
    return {"algorithm": f"{strategy}-priority-seeded-v1", "algorithm_version": "1.0", "strategy": strategy, "seed": seed, "population_fingerprint": source_fingerprint, "population_size": len(df), "requested_size": size, "sample_size": len(refs), "selected_records": refs, "human_approval_required": True}
