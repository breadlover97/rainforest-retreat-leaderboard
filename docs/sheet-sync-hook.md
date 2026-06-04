# Sheet Sync Hook

This adds near-live leaderboard updates when a new Google Form response lands in the linked Sheet.

## How It Works

```text
Google Form submission
  -> Google Sheet on form submit trigger
  -> Google Apps Script calls GitHub repository_dispatch
  -> Sync leaderboard workflow runs
  -> data/leaderboard.json updates
  -> GitHub Pages serves the refreshed leaderboard
```

The public website still reads only `data/leaderboard.json`, so the privacy boundary remains the same:

- rank
- masked participant name
- total ballots
- last generated timestamp

No raw form responses, phone numbers, advisor names, or referrer relationships are published.

## GitHub Setup

Create a fine-grained GitHub personal access token.

Recommended settings:

- Resource owner: `breadlover97`
- Repository access: only `breadlover97/rainforest-retreat-leaderboard`
- Repository permissions: `Contents: Read and write`

This permission is needed because GitHub's `repository_dispatch` endpoint requires write access to repository contents.

## Google Apps Script Setup

1. Open the Google Sheet.
2. Go to `Extensions` -> `Apps Script`.
3. Paste the contents of `scripts/google_apps_script_sheet_sync.gs`.
4. In Apps Script, go to `Project Settings` -> `Script properties`.
5. Add:

```text
GITHUB_DISPATCH_TOKEN = <your GitHub token>
```

6. Go to `Triggers`.
7. Add a trigger:

```text
Function: onFormSubmit
Event source: From spreadsheet
Event type: On form submit
```

8. Run `testLeaderboardSync` once from Apps Script to authorize the script and confirm that GitHub Actions starts.

## Notes

- The script includes a 60-second debounce so repeated submissions do not spam GitHub Actions.
- The existing 12am and 12pm scheduled sync remains as a fallback.
- GitHub Pages deployment is not instant. Expect the public site to update in roughly 1-3 minutes after the trigger fires.
