import csv
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "leaderboard.json"
DEFAULT_SHEET_GID = "8052026"
FORMULA_ERRORS = {"#REF!", "#N/A", "#VALUE!", "#ERROR!", "#DIV/0!", "#NAME?", "#NUM!"}


def get_public_csv_values() -> list[list[str]]:
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    if not spreadsheet_id:
        raise RuntimeError("Missing GOOGLE_SHEETS_SPREADSHEET_ID secret.")

    sheet_gid = os.environ.get("GOOGLE_SHEETS_GID", DEFAULT_SHEET_GID).strip()
    query = urlencode({"format": "csv", "gid": sheet_gid})
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?{query}"

    with urlopen(url, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Unable to fetch public CSV export: HTTP {response.status}")
        payload = response.read().decode("utf-8-sig")

    values = list(csv.reader(payload.splitlines()))
    if not values or values[0][:3] != ["Rank", "Masked Name", "Total Ballots"]:
        raise RuntimeError(
            "Unexpected public export format. Expected columns: Rank, Masked Name, Total Ballots."
        )

    return values[:201]


def parse_int(value: str, field_name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid {field_name}: {value!r}") from exc


def has_formula_error(values: list[str]) -> bool:
    return any(value.upper() in FORMULA_ERRORS for value in values)


def parse_entries(values: list[list[str]]) -> list[dict]:
    entries = []
    for row_number, row in enumerate(values[1:], start=2):
        if len(row) < 3:
            continue

        rank, masked_name, total_ballots = [item.strip() for item in row[:3]]
        if has_formula_error([rank, masked_name, total_ballots]):
            continue
        if not rank and not masked_name and not total_ballots:
            continue
        if not rank or not masked_name or not total_ballots:
            raise RuntimeError(f"Incomplete leaderboard row at export row {row_number}.")

        entries.append(
            {
                "rank": parse_int(rank, "rank"),
                "maskedName": masked_name,
                "totalBallots": parse_int(total_ballots, "total ballots"),
            }
        )

    return entries


def main() -> None:
    entries = parse_entries(get_public_csv_values())
    now = datetime.now(ZoneInfo("Asia/Singapore")).isoformat(timespec="seconds")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps({"generatedAt": now, "entries": entries}, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
