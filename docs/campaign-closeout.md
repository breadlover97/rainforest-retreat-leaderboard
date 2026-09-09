# Campaign Closeout

The Rainforest Retreat Giveaway has ended. The repository now serves as a campaign archive.
Keep the existing leaderboard snapshot and the draw implementation so the published figures
and original draw records remain reviewable.

## Confirmed on 9 September 2026

- GitHub Actions workflow `Sync leaderboard` (ID `272999213`) was disabled manually and its
  live state was verified as `disabled_manually`.
- No queued or in-progress runs of that workflow were present at the shutdown check.
- The same `CAMPAIGN_SYNC_ENABLED = false` guard was saved in the live Apps Script project's
  shared sync function, before lock acquisition and token access. The saved state was checked,
  and an `onFormSubmit` verification run completed successfully at 11:30:15–11:30:16am
  Singapore time. The callback now returns without dispatching to GitHub.
- The linked giveaway Form was changed to **Not accepting responses**. Its saved closure message
  states that the giveaway has ended and entries closed on 31 July 2026. Existing responses were retained.

## Repository Changes

- Removed the twice-daily schedule and `sheet-sync` repository-dispatch trigger.
- Retained a manual-only workflow for deliberate future reuse. It requires both re-enabling
  the workflow in GitHub and explicitly confirming `refresh_archived_data`.
- Set the saved Apps Script to `CAMPAIGN_SYNC_ENABLED = false`, making its automatic and manual-test
  handlers return before token access, locking, or network requests.
- Preserved `data/leaderboard.json`, the draw source, and audit tooling. The snapshot's generated
  timestamp is historical; it is not a statement that data was regenerated at closeout.

## Remaining Google-Side Cleanup

The repository copy of Apps Script is separate from the live project bound to the campaign Sheet.
Both copies now contain the inactive guard.

The live project showed two installable triggers owned by the signed-in user, both pointing to
`onFormSubmit`: an **On form submit** trigger and an **On open** trigger. They remain installed
pending explicit approval for permanent deletion. Their callback is inactive; trigger removal
has not been completed.

The stored dispatch token, other accounts' triggers, and any additional Google-side notification
automations have not been verified as retired. Continue the
[Sheet hook retirement checklist](sheet-sync-hook.md#google-side-retirement) as those items are
checked, and update this record with the actual outcomes.

## Records to Retain

- Preserve the private response Sheet and the frozen CSV used for the official draw.
- Preserve the versioned ceremony JSON, raw public seed, CSV SHA-256, deployed commit, and any
  draw recording. Keep files containing personal information in private storage.
- Retain the historical public snapshot without publishing additional participant details.
- Confirm winner notification and prize fulfilment against the organiser's records. Repository
  contents alone do not establish that those follow-ups are complete.

Keep the response Sheet available to the organisers for outstanding fulfilment and reconciliation.
Review its sharing separately from the static public archive. Do not delete raw responses, audit evidence, or script history as part of disabling
automation. Keep GitHub Pages available for the archive if continued public reference is useful.
