"""One-off importer: load Qualys vulnerability data from an .xlsx into the DB.

Mirrors the normal CSV ingestion pipeline (app/services/csv_parser.py +
vuln_pipeline.py) but reads the .xlsx directly — no pandas/openpyxl needed
(xlsx is a zip of XML). Creates ONE ScanRun and inserts the parsed
VulnerabilityFinding rows linked to it, exactly like the CSV flow.

Usage:
    ./venv/bin/python import_qualys_xlsx.py [path/to/file.xlsx] [--force]

Default path: ../Documentation/Qualys Vulnerability data.xlsx
Idempotent guard: refuses to run if findings already exist unless --force.
"""
import os
import sys
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, date, timedelta

from app.core.sync_db import get_sync_session
from app.models import ScanRun, VulnerabilityFinding
from app.services.csv_parser import COLUMN_MAP, _norm, _parse_date, _parse_float
from app.services.vuln_pipeline import _enrich, _summarize

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
EXCEL_EPOCH = date(1899, 12, 30)  # accounts for the Excel 1900 leap-year bug
DATE_COLUMNS = {"last_scan_date", "first_detected"}
DEFAULT_XLSX = os.path.join(
    os.path.dirname(__file__), "..", "Documentation", "Qualys Vulnerability data.xlsx"
)


def _col_letter(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def _cell_value(c) -> str:
    t = c.get("t")
    if t == "inlineStr":
        is_ = c.find(f"{NS}is")
        return "".join(x.text or "" for x in is_.iter(f"{NS}t")) if is_ is not None else ""
    v = c.find(f"{NS}v")
    return v.text if v is not None else ""


def _coerce_date(value):
    """Excel serial (all-digit) -> date; otherwise fall back to the app parser."""
    if value is None:
        return None
    if value.isdigit():
        return EXCEL_EPOCH + timedelta(days=int(value))
    return _parse_date(value)


def read_rows(xlsx_path: str):
    """Yield finding dicts (DB column keys), matching parse_csv() semantics."""
    z = zipfile.ZipFile(xlsx_path)
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = root.find(f"{NS}sheetData").findall(f"{NS}row")
    if not rows:
        return

    # header row: column-letter -> normalized DB column (or None to ignore)
    header = {}
    for c in rows[0].findall(f"{NS}c"):
        col = COLUMN_MAP.get(_norm(_cell_value(c) or ""))
        header[_col_letter(c.get("r"))] = col

    for row in rows[1:]:
        finding = {}
        for c in row.findall(f"{NS}c"):
            col = header.get(_col_letter(c.get("r")))
            if col is None:
                continue
            value = (_cell_value(c) or "").strip() or None
            if col in ("qds", "true_risk_score"):
                finding[col] = _parse_float(value)
            elif col in DATE_COLUMNS:
                finding[col] = _coerce_date(value)
            elif col == "internet_facing":
                finding[col] = "Yes" if (value or "").lower() in ("yes", "y", "true", "1") else "No"
            else:
                finding[col] = value
        if any(finding.values()):
            yield finding


def main():
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv
    xlsx_path = os.path.abspath(args[0]) if args else os.path.abspath(DEFAULT_XLSX)

    if not os.path.exists(xlsx_path):
        sys.exit(f"File not found: {xlsx_path}")

    findings = _enrich(list(read_rows(xlsx_path)))
    if not findings:
        sys.exit("No rows parsed — check the sheet headers.")

    with get_sync_session() as session:
        existing = session.query(VulnerabilityFinding).count()
        if existing and not force:
            sys.exit(f"{existing} findings already exist. Re-run with --force to add another scan run.")

        distinct_ips = len({f.get("ip") for f in findings if f.get("ip")})
        scan_run = ScanRun(
            run_id=str(uuid.uuid4()),
            trigger_type="on_demand",
            triggered_by=1,  # seed admin
            server_count=distinct_ips,
            status="running",
            started_at=datetime.utcnow(),
        )
        session.add(scan_run)
        session.flush()

        for f in findings:
            session.add(VulnerabilityFinding(scan_run_id=scan_run.id, **f))

        scan_run.status = "completed"
        scan_run.completed_at = datetime.utcnow()
        session.commit()

        summary = _summarize(findings)
        print(f"Imported {summary['total_findings']} findings across {distinct_ips} assets "
              f"into scan_run id={scan_run.id} ({scan_run.run_id}).")
        print("By severity:", summary["by_severity"])


if __name__ == "__main__":
    main()
