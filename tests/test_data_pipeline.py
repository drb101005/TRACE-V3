import json
import io

import pytest

from backend.services.data_pipeline import DatasetError, load_dataframe, profile_dataframe
from backend.services.audit_engine import deterministic_sample, execute_check

def test_csv_keeps_identifiers_and_profiles_missing_values():
    df, source = load_dataframe("sales.csv", b"Invoice No,Invoice Total,Invoice Date\n0012,100.50,2026-01-01\n0013,,bad-date\n")
    assert df.invoice_no.tolist() == ["0012", "0013"]
    profile = profile_dataframe(df, source)
    assert profile["row_count"] == 2
    assert profile["missing_values"]["invoice_total"]["count"] == 1
    assert profile["date_ranges"]["invoice_date"]["invalid_count"] == 1

def test_json_records_and_duplicate_headers():
    df, _ = load_dataframe("data.json", json.dumps({"records": [{"Invoice No": "0001", "Amount": "10"}]}).encode())
    assert df.iloc[0]["invoice_no"] == "0001"
    with pytest.raises(DatasetError, match="Duplicate column"):
        load_dataframe("bad.csv", b"id,ID\n1,2\n")

def test_valid_xlsx():
    from openpyxl import Workbook
    workbook = Workbook(); sheet = workbook.active
    sheet.append(["Invoice No", "Amount"]); sheet.append(["0007", 12.5])
    stream = io.BytesIO(); workbook.save(stream); workbook.close()
    df, _ = load_dataframe("sales.xlsx", stream.getvalue())
    assert df.invoice_no.iloc[0] == "0007"
    assert str(df.amount.iloc[0]) == "12.5"

@pytest.mark.parametrize("filename,data", [("bad.exe", b"x"), ("empty.csv", b"")])
def test_rejects_bad_or_empty_inputs(filename, data):
    with pytest.raises(DatasetError):
        load_dataframe(filename, data)

def test_invoice_duplicate_negative_and_math_exceptions():
    raw = b"Invoice No,Taxable Amount,Tax,Invoice Total\n0001,100,10,110\n0001,-4,0,1\n,20,2,22\n"
    df, _ = load_dataframe("sales.csv", raw)
    assert execute_check("missing_invoice_id", df, source_artifact_id="a1")["exception_count"] == 1
    assert execute_check("duplicate_invoice", df, source_artifact_id="a1")["exception_count"] == 2
    assert execute_check("negative_amount", df, source_artifact_id="a1")["exception_count"] == 1
    assert execute_check("invoice_arithmetic", df, source_artifact_id="a1")["exception_count"] == 1

def test_sample_is_repeatable_and_bounded_even_for_small_population():
    df, _ = load_dataframe("sales.json", b'[{"invoice_no":"a","amount":"1"},{"invoice_no":"b","amount":"100"}]')
    first = deterministic_sample(df, source_fingerprint="abc", size=30, seed="fixed", strategy="risk-based")
    second = deterministic_sample(df, source_fingerprint="abc", size=30, seed="fixed", strategy="risk-based")
    assert first == second
    assert first["sample_size"] == 2
    assert first["human_approval_required"] is True
