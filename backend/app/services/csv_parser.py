"""Parse vulnerability scan CSV files into normalized finding dicts."""
import csv
from datetime import datetime
from typing import List, Dict, Optional

# CSV header → DB column. Matching is case/space/underscore-insensitive.
COLUMN_MAP = {
    "ip": "ip",
    "network": "network",
    "dns": "dns",
    "netbios": "netbios",
    "os": "os",
    "title": "title",
    "severity": "severity",
    "cveid": "cve_id",
    "vendorreference": "vendor_reference",
    "threat": "threat",
    "impact": "impact",
    "solution": "solution",
    "results": "results",
    "qds": "qds",
    "assetgroup": "asset_group",
    "serverrole": "server_role",
    "lastscandate": "last_scan_date",
    "scanstatus": "scan_status",
    "operatingsystemfamily": "os_family",
    "osfamily": "os_family",
    # v2 columns
    "trueriskscore": "true_risk_score",
    "location": "location",
    "assetcriticality": "asset_criticality",
    "assetowner": "asset_owner",
    "internetfacing": "internet_facing",
    "firstdetected": "first_detected",
}

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"]


def _norm(header: str) -> str:
    return "".join(ch for ch in header.lower() if ch.isalnum())


def _parse_date(value: str) -> Optional[datetime]:
    value = (value or "").strip()
    if not value:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(value: str) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_csv(file_path: str) -> List[Dict]:
    """Read a vulnerability CSV and return a list of finding dicts (DB column keys)."""
    findings: List[Dict] = []
    with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return findings
        header_map = {h: COLUMN_MAP.get(_norm(h)) for h in reader.fieldnames}

        for row in reader:
            finding: Dict = {}
            for raw_header, value in row.items():
                col = header_map.get(raw_header)
                if col is None:
                    continue
                value = (value or "").strip() or None
                if col in ("qds", "true_risk_score"):
                    finding[col] = _parse_float(value)
                elif col in ("last_scan_date", "first_detected"):
                    finding[col] = _parse_date(value)
                elif col == "internet_facing":
                    finding[col] = "Yes" if (value or "").lower() in ("yes", "y", "true", "1") else "No"
                else:
                    finding[col] = value
            if any(finding.values()):
                findings.append(finding)
    return findings
