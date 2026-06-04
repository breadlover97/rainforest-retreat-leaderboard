const GITHUB_OWNER = "breadlover97";
const GITHUB_REPO = "rainforest-retreat-leaderboard";
const DISPATCH_EVENT_TYPE = "sheet-sync";
const MIN_SECONDS_BETWEEN_TRIGGERS = 60;

function onFormSubmit(e) {
  triggerLeaderboardSync_("form_submit");
}

function testLeaderboardSync() {
  triggerLeaderboardSync_("manual_test");
}

function triggerLeaderboardSync_(source) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty("GITHUB_DISPATCH_TOKEN");
    if (!token) {
      throw new Error("Missing GITHUB_DISPATCH_TOKEN in Apps Script properties.");
    }

    const now = Math.floor(Date.now() / 1000);
    const lastTriggeredAt = Number(properties.getProperty("LAST_TRIGGERED_AT") || 0);
    if (now - lastTriggeredAt < MIN_SECONDS_BETWEEN_TRIGGERS) return;

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`;
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        event_type: DISPATCH_EVENT_TYPE,
        client_payload: {
          source,
          triggered_at: new Date().toISOString(),
        },
      }),
    });

    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error(`GitHub dispatch failed with HTTP ${status}: ${response.getContentText()}`);
    }

    properties.setProperty("LAST_TRIGGERED_AT", String(now));
  } finally {
    lock.releaseLock();
  }
}
