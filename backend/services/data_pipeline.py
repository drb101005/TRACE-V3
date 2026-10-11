"""Bounded, deterministic ingestion and profiling for trusted tabular formats."""
from __future__ import annotations

import csv
import io
import json
import re
import unicodedata
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xlsm", ".json"}
MAX_ROWS = 250_000

class DatasetError(ValueError):
    """Input data is unsupported, malformed, or outside configured limits."""

def _column_key(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().casefold()
    return re.sub(r"\s+", " ", text)

def _canonical_column(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().casefold()
    text = re.sub(r"[^\w]+", "_", text, flags=re.UNICODE).strip("_")
    return text or "unnamed_column"

def _check_columns(columns: list[Any]) -> list[str]:
    if not columns or all(not str(value or "").strip() for value in columns):
        raise DatasetError("The dataset has no usable column headers")
    keys = [_column_key(value) for value in columns]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    if duplicates:
        raise DatasetError(f"Duplicate column headers: {', '.join(duplicates[:10])}")
    canonical = [_canonical_column(value) for value in columns]
    normalized_duplicates = sorted({key for key in canonical if canonical.count(key) > 1})
    if normalized_duplicates:
        raise DatasetError(f"Column names collide after normalization: {', '.join(normalized_duplicates[:10])}")
    return canonical

def load_dataframe(filename: str, raw: bytes, *, sheet_name: str | int = 0, max_rows: int = MAX_ROWS) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Load supported tabular data without coercing identifier columns to numbers."""
    extension = Path(filename).suffix.casefold()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DatasetError(f"Unsupported format '{extension or '(no extension)'}'")
    if not raw:
        raise DatasetError("The uploaded file is empty")
    try:
        if extension in {".csv", ".tsv"}:
            text = raw.decode("utf-8-sig")
            delimiter = "\t" if extension == ".tsv" else None
            if delimiter is None:
                try:
                    delimiter = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|").delimiter
                except csv.Error:
                    delimiter = ","
            first_line = next(csv.reader(io.StringIO(text), delimiter=delimiter), [])
            _check_columns(first_line)
            df = pd.read_csv(io.StringIO(text), sep=delimiter, dtype="string", keep_default_na=False, nrows=max_rows + 1)
        elif extension in {".xlsx", ".xlsm"}:
            if not raw.startswith(b"PK\x03\x04"):
                raise DatasetError("The file extension does not match a valid Excel workbook")
            table = pd.read_excel(io.BytesIO(raw), sheet_name=sheet_name, dtype=object, engine="openpyxl", header=None, nrows=max_rows + 2)
            if table.empty:
                raise DatasetError("The selected Excel sheet is empty")
            headers = [str(value).strip() if not pd.isna(value) else "" for value in table.iloc[0].tolist()]
            _check_columns(headers)
            df = table.iloc[1:].copy()
            df.columns = headers
        else:
            text = raw.decode("utf-8-sig")
            payload = json.loads(text)
            if isinstance(payload, dict):
                payload = payload.get("records", payload.get("data", payload))
            if isinstance(payload, dict):
                payload = [payload]
            if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
                raise DatasetError("JSON must contain an array of objects or an object with a records array")
            if len(payload) > max_rows:
                raise DatasetError(f"Dataset exceeds the {max_rows:,} row processing limit")
            df = pd.DataFrame.from_records(payload)
        if len(df) > max_rows:
            raise DatasetError(f"Dataset exceeds the {max_rows:,} row processing limit")
        raw_columns = [str(c) for c in df.columns]
        canonical = _check_columns(raw_columns)
        column_map = {canonical_name: raw_name for canonical_name, raw_name in zip(canonical, raw_columns)}
        df.columns = canonical
        empty_mask = (df.isna() | df.astype("string").apply(lambda column: column.str.strip().eq(""))).all(axis=1) if len(df.columns) else pd.Series(True, index=df.index)
        empty_rows = int(empty_mask.sum())
        return df, {"source_filename": Path(filename).name, "source_format": extension.lstrip("."), "row_count": int(len(df)), "column_count": int(len(df.columns)), "column_map": column_map, "empty_row_count": empty_rows, "sheet": sheet_name if extension in {".xlsx", ".xlsm"} else None}
    except DatasetError:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, pd.errors.ParserError, ValueError, OSError, ImportError) as exc:
        raise DatasetError(f"Unable to parse {extension.lstrip('.').upper()} data: {exc}") from exc

def _as_decimal(value: Any) -> Decimal | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace(",", "").replace("₹", "").replace("INR", "").strip()
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        return Decimal(text)
    except InvalidOperation:
        return None

def _record_reference(row: pd.Series, row_number: int, columns: list[str]) -> dict[str, Any]:
    candidates = ("invoice_number", "invoice_no", "invoice_id", "voucher_number", "transaction_id", "record_id", "id")
    for key in candidates:
        if key in columns and str(row.get(key, "")).strip():
            return {"key_column": key, "key": str(row[key]).strip()}
    return {"source_row_number": row_number, "permanent_key": False}

def profile_dataframe(df: pd.DataFrame, source: dict[str, Any] | None = None) -> dict[str, Any]:
    columns = list(df.columns)
    missing: dict[str, dict[str, Any]] = {}
    unique: dict[str, int] = {}
    numeric: dict[str, dict[str, Any]] = {}
    dates: dict[str, dict[str, Any]] = {}
    candidates = []
    for column in columns:
        series = df[column]
        empty = series.isna() | series.astype("string").str.strip().eq("")
        missing_count = int(empty.sum())
        missing[column] = {"count": missing_count, "percent": round(100 * missing_count / len(df), 4) if len(df) else 0.0}
        unique[column] = int(series.nunique(dropna=True))
        decimals = [_as_decimal(v) for v in series.tolist()]
        valid = [v for v in decimals if v is not None]
        looks_monetary = bool(re.search(r"amount|revenue|sales|tax|total|value|price|debit|credit", column))
        if valid and (looks_monetary or len(valid) / max(1, len(df) - missing_count) >= 0.8):
            ordered = sorted(valid)
            total = sum(valid, Decimal("0"))
            median = ordered[len(ordered) // 2] if len(ordered) % 2 else (ordered[len(ordered)//2 - 1] + ordered[len(ordered)//2]) / 2
            numeric[column] = {"count": len(valid), "sum": str(total), "mean": str((total / len(valid)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)), "median": str(median), "min": str(ordered[0]), "max": str(ordered[-1]), "q25": str(ordered[max(0, int((len(ordered)-1)*.25))]), "q75": str(ordered[max(0, int((len(ordered)-1)*.75))])}
            if looks_monetary:
                candidates.append({"column": column, "kind": "monetary_candidate", "reason": "name suggests financial amount"})
        if re.search(r"date|time|period|month", column):
            parsed = pd.to_datetime(series, errors="coerce", format="mixed")
            valid_dates = parsed.dropna()
            dates[column] = {"valid_count": int(len(valid_dates)), "invalid_count": int(parsed.isna().sum() - missing_count), "min": valid_dates.min().isoformat() if len(valid_dates) else None, "max": valid_dates.max().isoformat() if len(valid_dates) else None}
    duplicate_rows = int(df.duplicated(keep=False).sum()) if len(df) else 0
    warnings = []
    if duplicate_rows: warnings.append({"code": "duplicate_rows", "count": duplicate_rows, "message": "Duplicate rows need review; source rows were retained."})
    if candidates: warnings.append({"code": "financial_column_mapping", "message": "Financial columns are candidates only and should be confirmed by the client/auditor."})
    return {"source": source or {}, "row_count": int(len(df)), "column_count": int(len(columns)), "columns": columns, "data_types": {c: str(df[c].dtype) for c in columns}, "missing_values": missing, "unique_counts": unique, "duplicate_row_count": duplicate_rows, "numeric_summary": numeric, "date_ranges": dates, "candidate_mappings": candidates, "warnings": warnings, "pipeline_version": "trace-pandas-1.0"}

def dataframe_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Produce JSON-safe values while preserving string identifiers."""
    return df.astype(object).where(pd.notna(df), None).to_dict(orient="records")
