const body = document.querySelector("#leaderboard-body");
const lastSync = document.querySelector("#last-sync");
const entryCount = document.querySelector("#entry-count");
const leaderboardPanel = document.querySelector(".leaderboard-panel");
const leaderboardScrollHint = document.querySelector("#leaderboard-scroll-hint");
const faqToggle = document.querySelector(".faq-toggle");
const faqItems = [...document.querySelectorAll(".faq-list details")];
const backToTop = document.querySelector(".back-to-top");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const formatSyncTime = (isoString) => {
  if (!isoString) return "Not synced yet";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(isoString));
};

const renderRows = (entries) => {
  body.replaceChildren();
  const hasOverflowRows = entries.length > 10;
  leaderboardPanel?.classList.toggle("has-scroll", hasOverflowRows);
  if (leaderboardScrollHint) leaderboardScrollHint.hidden = !hasOverflowRows;

  if (!entries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-state";
    cell.textContent = "No ballot entries yet.";
    row.append(cell);
    body.append(row);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("tr");
    if (entry.rank <= 3) row.className = "rank-top";

    const rankCell = document.createElement("td");
    rankCell.textContent = `#${entry.rank}`;

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.maskedName;

    const ballotCell = document.createElement("td");
    const ballotBadge = document.createElement("span");
    ballotBadge.className = "ballot-count";
    ballotBadge.textContent = entry.totalBallots;
    ballotCell.append(ballotBadge);

    row.append(rankCell, nameCell, ballotCell);
    body.append(row);
  }
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
    body.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-state";
    cell.textContent = "Unable to load leaderboard right now.";
    row.append(cell);
    body.append(row);
  });

const animateDetails = (details, shouldOpen) => {
  const summary = details.querySelector("summary");
  if (!summary || motionQuery.matches) {
    details.open = shouldOpen;
    return;
  }

  details.style.overflow = "hidden";
  const startHeight = `${details.offsetHeight}px`;

  if (shouldOpen) {
    details.open = true;
  }

  const endHeight = shouldOpen ? `${details.scrollHeight}px` : `${summary.offsetHeight}px`;
  const animation = details.animate(
    { height: [startHeight, endHeight] },
    { duration: 220, easing: "ease-out" },
  );

  animation.onfinish = () => {
    details.open = shouldOpen;
    details.style.height = "";
    details.style.overflow = "";
    updateFaqToggle();
  };
  animation.oncancel = animation.onfinish;
};

const updateFaqToggle = () => {
  if (!faqToggle || !faqItems.length) return;

  const allOpen = faqItems.every((details) => details.open);
  faqToggle.textContent = allOpen ? "Close all" : "Expand all";
  faqToggle.setAttribute("aria-expanded", String(allOpen));
};

faqItems.forEach((details) => {
  const summary = details.querySelector("summary");
  summary?.addEventListener("click", (event) => {
    event.preventDefault();
    animateDetails(details, !details.open);
  });
});

faqToggle?.addEventListener("click", () => {
  const shouldOpen = faqItems.some((details) => !details.open);
  faqItems.forEach((details) => animateDetails(details, shouldOpen));
  if (motionQuery.matches) updateFaqToggle();
});

updateFaqToggle();

const updateBackToTop = () => {
  backToTop?.classList.toggle("is-visible", window.scrollY > 420);
};

backToTop?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: motionQuery.matches ? "auto" : "smooth",
  });
});

window.addEventListener("scroll", updateBackToTop, { passive: true });
updateBackToTop();
