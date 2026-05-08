# Rainforest Retreat Leaderboard

Static GitHub Pages leaderboard for The Rainforest Retreat Giveaway.

## Public Data

The published site and `data/leaderboard.json` contain only:

- rank
- masked participant name
- total ballots
- last generated timestamp

No phone numbers, advisor names, referrer names, referral relationships, or raw form responses are committed to the repo.

## Sync

The workflow runs at `12:00pm` and `12:00am` Singapore time using:

```yaml
cron: "0 4,16 * * *"
```

GitHub schedules may run a few minutes late. The site displays the timestamp from `data/leaderboard.json`.

## Required Secrets

Add these repository secrets before enabling the workflow:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON key for a service account with read access to the spreadsheet
- `GOOGLE_SHEETS_SPREADSHEET_ID`: the private spreadsheet ID

The workflow reads only:

```text
'Public Leaderboard Export'!A1:C200
```

## Local Check

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
