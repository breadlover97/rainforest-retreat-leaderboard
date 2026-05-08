import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from google.oauth2 import service_account
from googleapiclient.discovery import build


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "leaderboard.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
DEFAULT_RANGE = "'Public Leaderboard Export'!A1:C200"


def load_service_account_info() -> dict:
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("Missing GOOGLE_SERVICE_ACCOUNT_JSON secret.")
    return json.loads(raw)


def get_sheet_values() -> list[list[str]]:
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    if not spreadsheet_id:
        raise RuntimeError("Missing GOOGLE_SHEETS_SPREADSHEET_ID secret.")

    credentials = service_account.Credentials.from_service_account_info(
        load_service_account_info(),
        scopes=SCOPES,
    )
    service = build("sheets", "v4", credentials=credentials)
    response = (
        service.spreadsheets()
        .values()
        .get(
            spreadsheetId=spreadsheet_id,
            range=os.environ.get("GOOGLE_SHEETS_RANGE", DEFAULT_RANGE),
            valueRenderOption="FORMATTED_VALUE",
        )
        .execute()
    )
    return response.get("values", [])


def parse_entries(values: list[list[str]]) -> list[dict]:
    entries = []
    for row in values[1:]:
        if len(row) < 3:
            continue

        rank, masked_name, total_ballots = [item.strip() for item in row[:3]]
        if not rank or not masked_name or not total_ballots:
            continue

        entries.append(
            {
                "rank": int(rank),
                "maskedName": masked_name,
                "totalBallots": int(total_ballots),
            }
        )

    return entries


def main() -> None:
    entries = parse_entries(get_sheet_values())
    now = datetime.now(ZoneInfo("Asia/Singapore")).isoformat(timespec="seconds")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps({"generatedAt": now, "entries": entries}, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
