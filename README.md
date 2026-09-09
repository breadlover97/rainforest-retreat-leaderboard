# Rainforest Retreat Leaderboard

Archived GitHub Pages leaderboard for The Rainforest Retreat Giveaway. The campaign has ended.

Automatic leaderboard updates are retired. Preserve `data/leaderboard.json` as the existing
published snapshot; closing the campaign does not regenerate participant data. The draw source
and audit tools remain available for checking the completed ceremony.

See [campaign closeout](docs/campaign-closeout.md) for confirmed shutdown actions and remaining
Google-side cleanup.

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

## Retired Sync

The `Sync leaderboard` GitHub Actions workflow was disabled manually on 9 September 2026.
Its former twice-daily schedule and Google Sheets `repository_dispatch` trigger have been
removed from the workflow source. The saved Apps Script also defaults to
`CAMPAIGN_SYNC_ENABLED = false`, so its submission and manual-test handlers return without calling GitHub.

The same inactive guard was saved separately in the live Apps Script project and its
`onFormSubmit` handler completed a no-op verification run. Two installable triggers remain
attached to that inactive handler pending approval to delete them. Script properties and Form
settings still require separate checks. See the [retired Sheet sync hook](docs/sheet-sync-hook.md).

Manual workflow support remains for deliberate future reuse. It requires re-enabling the
workflow in GitHub Actions and checking `refresh_archived_data` when dispatching it. Leave the
workflow disabled while this campaign is closed.

## Historical Sync Configuration

The retained sync implementation expects this repository secret:

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
