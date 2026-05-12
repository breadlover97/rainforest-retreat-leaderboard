const body = document.querySelector("#leaderboard-body");
const lastSync = document.querySelector("#last-sync");
const entryCount = document.querySelector("#entry-count");
const leaderboardPanel = document.querySelector(".leaderboard-panel");
const leaderboardScrollHint = document.querySelector("#leaderboard-scroll-hint");
const leaderboardPagination = document.querySelector("#leaderboard-pagination");
const leaderboardPageSize = document.querySelector("#leaderboard-page-size");
const leaderboardPrev = document.querySelector("#leaderboard-prev");
const leaderboardNext = document.querySelector("#leaderboard-next");
const leaderboardPageStatus = document.querySelector("#leaderboard-page-status");
const faqToggle = document.querySelector(".faq-toggle");
const faqItems = [...document.querySelectorAll(".faq-list details")];
const backToTop = document.querySelector(".back-to-top");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileLeaderboardQuery = window.matchMedia("(max-width: 760px)");

let leaderboardEntries = [];
let leaderboardCurrentPage = 1;

const formatSyncTime = (isoString) => {
  if (!isoString) return "Not synced yet";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(isoString));
};

const getLeaderboardPageSize = () => {
  if (leaderboardPageSize?.value === "all") return leaderboardEntries.length || 1;
  return Number(leaderboardPageSize?.value || 10);
};

const renderTableRows = (entries) => {
  body.replaceChildren();

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

const renderRows = (entries) => {
  leaderboardEntries = entries;

  const isMobile = mobileLeaderboardQuery.matches;
  const shouldPaginate = isMobile && entries.length > 10;
  const pageSize = getLeaderboardPageSize();
  const totalPages = shouldPaginate ? Math.ceil(entries.length / pageSize) : 1;

  leaderboardCurrentPage = Math.min(Math.max(leaderboardCurrentPage, 1), totalPages);

  const startIndex = shouldPaginate ? (leaderboardCurrentPage - 1) * pageSize : 0;
  const endIndex = shouldPaginate ? Math.min(startIndex + pageSize, entries.length) : entries.length;
  const visibleEntries = shouldPaginate ? entries.slice(startIndex, endIndex) : entries;
  const hasDesktopOverflow = !isMobile && entries.length > 10;

  leaderboardPanel?.classList.toggle("has-scroll", hasDesktopOverflow);
  if (leaderboardScrollHint) leaderboardScrollHint.hidden = !hasDesktopOverflow;
  if (leaderboardPagination) leaderboardPagination.hidden = !shouldPaginate;

  if (leaderboardPrev) leaderboardPrev.disabled = leaderboardCurrentPage <= 1;
  if (leaderboardNext) leaderboardNext.disabled = leaderboardCurrentPage >= totalPages;
  if (leaderboardPageStatus) {
    leaderboardPageStatus.textContent =
      shouldPaginate && leaderboardPageSize?.value === "all"
        ? `All ${entries.length}`
        : `Page ${leaderboardCurrentPage} of ${totalPages}`;
  }

  renderTableRows(visibleEntries);
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

leaderboardPageSize?.addEventListener("change", () => {
  leaderboardCurrentPage = 1;
  renderRows(leaderboardEntries);
});

leaderboardPrev?.addEventListener("click", () => {
  leaderboardCurrentPage -= 1;
  renderRows(leaderboardEntries);
});

leaderboardNext?.addEventListener("click", () => {
  leaderboardCurrentPage += 1;
  renderRows(leaderboardEntries);
});

const handleLeaderboardViewportChange = () => {
  leaderboardCurrentPage = 1;
  renderRows(leaderboardEntries);
};

if (mobileLeaderboardQuery.addEventListener) {
  mobileLeaderboardQuery.addEventListener("change", handleLeaderboardViewportChange);
} else {
  mobileLeaderboardQuery.addListener(handleLeaderboardViewportChange);
}

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
