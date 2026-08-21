# Rainforest Retreat Leaderboard

Static GitHub Pages leaderboard for The Rainforest Retreat Giveaway.

## Public Data

The published site and `data/leaderboard.json` contain only:

- rank
- masked participant name
- total ballots
- last generated timestamp

No phone numbers, advisor names, referrer names, referral relationships, or raw form responses are committed to the repo.

## Lucky Draw Wheel

`draw.html` contains the weighted lucky draw experience. The public leaderboard is used only
for a non-spinnable preview. An official draw requires a frozen CSV selected from the user's
device with exactly these columns:

```csv
participant_id,display_name,ballots
```

- `participant_id` must be a stable, unique opaque ID for one real person.
- `display_name` should be the masked name shown during the public ceremony.
- `ballots` must be a positive whole number.
- The browser rejects snapshots above 10,000 total virtual tickets as a safety limit.

The CSV is processed entirely in the browser and is not uploaded or committed. The selection
engine matches the dependency-free Python audit tool: it hashes the exact CSV bytes and the
explicit seed, creates one SHA-256-ranked virtual ticket per ballot, then awards the Grand Prize
and three Gift Prizes to the first four unique participant IDs. The wheel only animates to those
precomputed results.

Before the seed becomes available, record or publish the exact CSV's displayed SHA-256. After the
fourth reveal, download and preserve the versioned JSON ceremony envelope with the frozen CSV,
raw public seed, deployed commit and draw recording. Its `selection_audit` member is the unchanged
canonical deterministic audit, and `selection_audit_sha256` authenticates that member.

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

Run the deterministic draw-engine tests with:

```bash
npm test
```
