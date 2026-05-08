const body = document.querySelector("#leaderboard-body");
const lastSync = document.querySelector("#last-sync");
const entryCount = document.querySelector("#entry-count");

const formatSyncTime = (isoString) => {
  if (!isoString) return "Not synced yet";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(isoString));
};

const renderRows = (entries) => {
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">No ballot entries yet.</td></tr>';
    return;
  }

  body.innerHTML = entries
    .map((entry) => {
      const rankClass = entry.rank <= 3 ? "rank-top" : "";
      return `
        <tr class="${rankClass}">
          <td>#${entry.rank}</td>
          <td>${entry.maskedName}</td>
          <td><span class="ballot-count">${entry.totalBallots}</span></td>
        </tr>
      `;
    })
    .join("");
};

fetch("data/leaderboard.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load leaderboard data");
    return response.json();
  })
  .then((data) => {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    renderRows(entries);
    lastSync.textContent = formatSyncTime(data.generatedAt);
    entryCount.textContent = `${entries.length} participant${entries.length === 1 ? "" : "s"}`;
  })
  .catch(() => {
    lastSync.textContent = "Sync unavailable";
    entryCount.textContent = "- participants";
    body.innerHTML =
      '<tr><td colspan="3" class="empty-state">Unable to load leaderboard right now.</td></tr>';
  });
