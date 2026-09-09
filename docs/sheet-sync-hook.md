# Retired Sheet Sync Hook

The Rainforest Retreat Giveaway has ended. This integration is retired and must remain inactive
while the campaign is closed. See [campaign closeout](campaign-closeout.md) for shutdown status.

## Previous Integration

```text
Google Form submission
  -> Google Sheet on form submit trigger
  -> Google Apps Script calls GitHub repository_dispatch
  -> Sync leaderboard workflow runs
  -> data/leaderboard.json updates
  -> GitHub Pages serves the refreshed leaderboard
```

The former schedule ran at 12am and 12pm Singapore time. Both the schedule and the
`repository_dispatch` event have been removed from the workflow source. GitHub's live
`Sync leaderboard` workflow is also disabled manually.

The public website reads the preserved `data/leaderboard.json`, which contains only rank, masked
participant name, total ballots, and the last generated timestamp. Raw form responses, phone
numbers, advisor names, and referrer relationships must remain private.

## Saved Apps Script Is Inactive

`scripts/google_apps_script_sheet_sync.gs` now sets `CAMPAIGN_SYNC_ENABLED = false`. Both
`onFormSubmit` and `testLeaderboardSync` stop before accessing script properties or making an
outbound request. The existing integration source is retained for reference and future reuse.

Changing this repository file does **not** update the live Apps Script project. During closeout
on 9 September 2026, the same false guard was saved separately in the live project and an
`onFormSubmit` verification run completed successfully at 11:30:15–11:30:16am Singapore time.
The callback is inactive before lock acquisition, token access, or a GitHub dispatch.

Two user-owned triggers still point to `onFormSubmit`: one on form submission and one on
spreadsheet open. Permanent removal is pending the user's approval. Their callback is already
inactive, but the trigger records are still installed. Stored token and linked Form settings
have not been verified as cleaned up.

## Google-Side Retirement

1. Open the campaign Sheet, then **Extensions → Apps Script**. Confirm the project belongs to
   this campaign before changing it.
2. Preserve the existing project source and identify all campaign-specific triggers. Remove
   the `onFormSubmit` trigger and any campaign-specific time-driven triggers once identified.
   Check the project under each account that installed triggers; one account's list may not
   establish that all owners' triggers are gone.
3. Save the inactive script from this repository in the live project, or apply the same guard
   to the campaign's existing sync function without overwriting unrelated functions.
4. Remove the campaign's `GITHUB_DISPATCH_TOKEN` script property after confirming it is no
   longer used. Revoke a dedicated campaign token in GitHub; a shared token requires checking
   its other uses before revocation. `LAST_TRIGGERED_AT` can also be removed.
5. Close response collection in the linked campaign Form and check for separate add-ons or
   notification rules that may still send campaign messages.
6. Verify subsequent Apps Script executions and GitHub Actions runs show no campaign sync.

The GitHub workflow no longer accepts `sheet-sync` dispatches, so a residual Google trigger
cannot start this workflow. Removing that trigger still matters because it prevents unnecessary
Google executions and outbound API requests.

## Deliberate Future Reuse

Do not resume the old campaign merely to test the integration. For a new campaign, first create
an appropriate data source, review the public export, preserve the old snapshot and ceremony
evidence, and approve the new publishing arrangement.

The retained workflow supports manual dispatch only. Re-enable it explicitly in GitHub Actions,
configure the correct `GOOGLE_SHEETS_SPREADSHEET_ID`, review the tab ID in the workflow, and
check `refresh_archived_data` to permit a refresh. Automated dispatch or scheduling would require
a separate, reviewed workflow change. Setting `CAMPAIGN_SYNC_ENABLED = true` alone will not restore
the retired integration.
