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

The workflow can also be triggered by a Google Sheets form-submit hook using GitHub's `repository_dispatch` event. See:

```text
docs/sheet-sync-hook.md
```

## Required Secret

Add this repository secret before enabling the workflow:

- `GOOGLE_SHEETS_SPREADSHEET_ID`: the private spreadsheet ID

The workflow reads only the public CSV export for this tab:

```text
Public Leaderboard Export, gid 8052026
```

No Google service-account key is required.

## Local Check

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
