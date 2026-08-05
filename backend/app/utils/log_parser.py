"""Ansible log parser + CSV path extraction for the vulnerability pipeline."""
import re
from datetime import datetime
from typing import List, Dict, Optional


class AnsibleLogParser:
    ANSI_PATTERN = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

    LEVEL_PATTERNS = {
        "ERROR": re.compile(r"(?i)(error|failed|fatal)"),
        "WARNING": re.compile(r"(?i)(warn|warning|deprecated)"),
        "DEBUG": re.compile(r"(?i)(debug|verbose)"),
    }

    TASK_PATTERN = re.compile(r"^TASK \[(.*?)\]")
    PLAY_PATTERN = re.compile(r"^PLAY \[(.*?)\]")
    OK_PATTERN = re.compile(r"^ok: \[(.*?)\]")
    CHANGED_PATTERN = re.compile(r"^changed: \[(.*?)\]")
    FAILED_PATTERN = re.compile(r"^failed: \[(.*?)\]")
    SKIPPED_PATTERN = re.compile(r"^skipping: \[(.*?)\]")

    # CSV path detection — matches common phrasings the playbook may emit.
    # e.g. "CSV saved to /tmp/report.csv", "report written at /var/x.csv",
    #      "csv_path=/opt/out.csv", or a bare path ending in .csv.
    CSV_PATH_PATTERNS = [
        re.compile(r"(?i)csv[\s_]*(?:file|report|path)?\s*(?:saved|written|created|generated)?\s*(?:to|at|=|:)?\s*([\"']?)(?P<path>[^\s\"']+\.csv)\1"),
        re.compile(r"(?P<path>(?:/|\.{0,2}/)[^\s\"']+\.csv)"),
    ]

    @staticmethod
    def strip_ansi_codes(text: str) -> str:
        return AnsibleLogParser.ANSI_PATTERN.sub("", text)

    @staticmethod
    def detect_log_level(line: str) -> str:
        for level, pattern in AnsibleLogParser.LEVEL_PATTERNS.items():
            if pattern.search(line):
                return level
        return "INFO"

    @staticmethod
    def parse_line(line: str, line_number: int) -> Dict:
        clean = AnsibleLogParser.strip_ansi_codes(line)
        return {
            "line_number": line_number,
            "content": clean.rstrip(),
            "log_level": AnsibleLogParser.detect_log_level(clean),
            "timestamp": datetime.utcnow(),
        }

    @staticmethod
    def parse_output(output, start_line: int = 0) -> List[Dict]:
        lines = output.split("\n") if isinstance(output, str) else output
        parsed = []
        for idx, line in enumerate(lines, start=start_line + 1):
            if line.strip():
                parsed.append(AnsibleLogParser.parse_line(line, idx))
        return parsed

    @staticmethod
    def extract_csv_path(output) -> Optional[str]:
        """Scan output (str or list of lines) for a generated CSV file path."""
        if isinstance(output, list):
            text = "\n".join(c.get("content", "") if isinstance(c, dict) else str(c) for c in output)
        else:
            text = output or ""
        text = AnsibleLogParser.strip_ansi_codes(text)
        for pattern in AnsibleLogParser.CSV_PATH_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group("path").strip()
        return None


log_parser = AnsibleLogParser()
