import {
  ALGORITHM_VERSION,
  DRAW_DOMAIN,
  PRIZES,
  conductDraw,
  parseParticipants,
  sha256Hex,
  stableAuditJson,
} from "./draw-engine.js";

const canvas = document.querySelector("#draw-wheel");
const context = canvas.getContext("2d");
const rotator = document.querySelector("#wheel-rotator");
const wheelSpin = document.querySelector("#wheel-spin");
const spinButton = document.querySelector("#spin-button");
const fileInput = document.querySelector("#snapshot-file");
const seedReference = document.querySelector("#seed-reference");
const seedInput = document.querySelector("#draw-seed");
const freezeConfirmation = document.querySelector("#freeze-confirmation");
const downloadAudit = document.querySelector("#download-audit");
const resetDraw = document.querySelector("#reset-draw");
const snapshotName = document.querySelector("#snapshot-name");
const snapshotHash = document.querySelector("#snapshot-hash");
const wheelMode = document.querySelector("#wheel-mode");
const currentPrize = document.querySelector("#current-prize");
const eligibleCount = document.querySelector("#eligible-count");
const ballotCount = document.querySelector("#ballot-count");
const wheelMessage = document.querySelector("#wheel-message");
const resultItems = [...document.querySelectorAll("#result-list li")];
const winnerDialog = document.querySelector("#winner-dialog");
const winnerPrize = document.querySelector("#winner-prize");
const winnerName = document.querySelector("#winner-name");
const winnerDetail = document.querySelector("#winner-detail");
const continueDraw = document.querySelector("#continue-draw");
const confetti = document.querySelector("#confetti");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const palette = [
  { fill: "#1f6b4b", text: "#ffffff" },
  { fill: "#d7a14b", text: "#10231d" },
  { fill: "#31694d", text: "#ffffff" },
  { fill: "#e7cf83", text: "#10231d" },
  { fill: "#2b5645", text: "#ffffff" },
  { fill: "#a8c79c", text: "#10231d" },
  { fill: "#844325", text: "#ffffff" },
  { fill: "#3e6f5a", text: "#ffffff" },
];

const state = {
  previewParticipants: [],
  csvBytes: null,
  fileName: "",
  inputSha256: "",
  participants: [],
  remainingParticipants: [],
  segments: [],
  drawSession: null,
  drawSeed: "",
  seedSource: "",
  currentIndex: 0,
  rotation: 0,
  spinning: false,
  pendingReveal: null,
  reveals: [],
  resetArmed: false,
  resetTimer: null,
  fileLoadSequence: 0,
  drawGeneration: 0,
};

const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

const truncateLabel = (label, limit = 21) =>
  label.length <= limit ? label : `${label.slice(0, Math.max(1, limit - 1))}…`;

const totalBallots = (participants) =>
  participants.reduce((sum, participant) => sum + participant.ballots, 0);

const setWheelStats = (participants) => {
  eligibleCount.textContent = String(participants.length);
  ballotCount.textContent = String(totalBallots(participants));
};

const drawEmptyWheel = (message) => {
  const size = canvas.width;
  const centre = size / 2;
  const radius = centre - 10;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.fillStyle = "#264a3c";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "rgba(255,255,255,0.35)";
  context.stroke();
  context.fillStyle = "#dcebd5";
  context.font = "700 26px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, centre, centre - 78);
  state.segments = [];
};

const renderWheel = (participants) => {
  if (!participants.length) {
    drawEmptyWheel("Awaiting ballot file");
    setWheelStats([]);
    return;
  }

  const size = canvas.width;
  const centre = size / 2;
  const radius = centre - 10;
  const ticketTotal = totalBallots(participants);
  let startAngle = 0;
  state.segments = [];
  context.clearRect(0, 0, size, size);

  participants.forEach((participant, index) => {
    const span = (Math.PI * 2 * participant.ballots) / ticketTotal;
    const endAngle = startAngle + span;
    const middleAngle = startAngle + span / 2;
    const color = palette[index % palette.length];

    context.beginPath();
    context.moveTo(centre, centre);
    context.arc(centre, centre, radius, startAngle, endAngle);
    context.closePath();
    context.fillStyle = color.fill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "rgba(255,255,255,0.42)";
    context.stroke();

    context.save();
    context.translate(centre, centre);
    context.rotate(middleAngle);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = color.text;
    context.font = `${span > 0.15 ? 800 : 700} ${span > 0.15 ? 18 : 13}px Inter, system-ui, sans-serif`;
    context.shadowColor = color.text === "#ffffff" ? "rgba(0,0,0,0.32)" : "transparent";
    context.shadowBlur = 2;
    context.fillText(truncateLabel(participant.displayName), radius - 28, 0, radius * 0.68);
    context.restore();

    state.segments.push({
      participantId: participant.participantId,
      startDegrees: (startAngle * 180) / Math.PI,
      spanDegrees: (span * 180) / Math.PI,
    });
    startAngle = endAngle;
  });

  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.lineWidth = 10;
  context.strokeStyle = "rgba(255,255,255,0.72)";
  context.stroke();

  canvas.setAttribute(
    "aria-label",
    `Weighted lucky draw wheel with ${participants.length} eligible participants and ${ticketTotal} ballots`,
  );
  setWheelStats(participants);
};

const resetResultList = () => {
  resultItems.forEach((item, index) => {
    item.className = index === 0 && state.csvBytes ? "is-current" : "";
    item.querySelector("strong").textContent = "Awaiting draw";
  });
};

const updateActionState = () => {
  resetDraw.disabled = state.spinning || (!state.csvBytes && !state.drawSession);

  if (state.drawSession) {
    const canSpin = !state.spinning && state.currentIndex < PRIZES.length;
    wheelSpin.disabled = !canSpin;
    spinButton.disabled = !canSpin;
    return;
  }

  const ready = Boolean(
    state.csvBytes &&
      seedReference.value.trim() &&
      seedInput.value.trim() &&
      freezeConfirmation.checked,
  );
  wheelSpin.disabled = !ready;
  spinButton.disabled = !ready;
};

const updatePrizeCopy = () => {
  if (state.currentIndex >= PRIZES.length) {
    currentPrize.textContent = "Draw complete";
    spinButton.textContent = "Four winners revealed";
    wheelMessage.textContent = "The audit record is ready to download.";
    return;
  }

  const prize = PRIZES[state.currentIndex];
  currentPrize.textContent = prize;
  spinButton.textContent = `Spin for ${prize}`;
  wheelSpin.querySelector("strong").textContent = "Spin";
};

const lockInputs = () => {
  fileInput.disabled = true;
  seedReference.readOnly = true;
  seedInput.readOnly = true;
  freezeConfirmation.disabled = true;
};

const unlockInputs = () => {
  fileInput.disabled = false;
  seedReference.readOnly = false;
  seedInput.readOnly = false;
  freezeConfirmation.disabled = false;
};

const buildPreviewParticipants = (entries) => {
  const participants = [];

  for (const [index, entry] of entries.entries()) {
    const displayName = String(entry?.maskedName ?? "").trim();
    const ballots = Number(entry?.totalBallots);
    if (!displayName || !Number.isInteger(ballots) || ballots <= 0) continue;
    participants.push({
      participantId: `preview-${index + 1}`,
      displayName,
      ballots,
    });
  }

  return participants;
};

const loadPublicPreview = async () => {
  try {
    const response = await fetch("data/leaderboard.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Preview unavailable");
    const data = await response.json();
    state.previewParticipants = buildPreviewParticipants(Array.isArray(data.entries) ? data.entries : []);
    if (!state.csvBytes && !state.drawSession) {
      renderWheel(state.previewParticipants);
      wheelMessage.textContent = state.previewParticipants.length
        ? "Preview only. Load the verified frozen CSV to enable an official spin."
        : "The public preview has no positive ballot entries yet.";
    }
  } catch {
    if (!state.csvBytes && !state.drawSession) {
      drawEmptyWheel("Preview unavailable");
      wheelMessage.textContent = "Unable to load the public leaderboard preview.";
    }
  }
};

const clearDrawSession = ({ keepSeed = false } = {}) => {
  state.csvBytes = null;
  state.fileName = "";
  state.inputSha256 = "";
  state.participants = [];
  state.remainingParticipants = [];
  state.drawSession = null;
  state.drawSeed = "";
  state.seedSource = "";
  state.currentIndex = 0;
  state.rotation = 0;
  state.spinning = false;
  state.pendingReveal = null;
  state.reveals = [];
  state.resetArmed = false;
  clearTimeout(state.resetTimer);
  state.resetTimer = null;
  state.fileLoadSequence += 1;
  state.drawGeneration += 1;

  rotator.style.transition = "none";
  rotator.style.transform = "rotate(0deg)";
  void rotator.offsetWidth;
  rotator.style.transition = "";

  fileInput.value = "";
  freezeConfirmation.checked = false;
  if (!keepSeed) {
    seedReference.value = "";
    seedInput.value = "";
  }
  snapshotName.textContent = "Not loaded";
  snapshotHash.textContent = "—";
  snapshotHash.removeAttribute("title");
  wheelMode.textContent = "Previewing public leaderboard";
  currentPrize.textContent = PRIZES[0];
  resetDraw.textContent = "Reset";
  resetDraw.disabled = true;
  downloadAudit.disabled = true;
  unlockInputs();
  resetResultList();
  updatePrizeCopy();
  renderWheel(state.previewParticipants);
  wheelMessage.textContent = "Preview only. Load the verified frozen CSV to enable an official spin.";
  updateActionState();
};

const handleFile = async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const loadSequence = ++state.fileLoadSequence;
  freezeConfirmation.checked = false;
  updateActionState();

  try {
    if (file.size > 2_000_000) throw new TypeError("CSV file is larger than 2 MB.");
    const csvBytes = new Uint8Array(await file.arrayBuffer());
    const participants = parseParticipants(csvBytes);
    const inputSha256 = await sha256Hex(csvBytes);
    if (loadSequence !== state.fileLoadSequence) return;

    state.csvBytes = csvBytes;
    state.fileName = file.name;
    state.inputSha256 = inputSha256;
    state.participants = participants;
    state.remainingParticipants = participants.slice();
    state.drawSession = null;
    state.currentIndex = 0;
    state.reveals = [];

    snapshotName.textContent = file.name;
    snapshotName.title = file.name;
    snapshotHash.textContent = inputSha256;
    snapshotHash.title = inputSha256;
    wheelMode.textContent = "Frozen official snapshot loaded";
    wheelMessage.textContent =
      "Snapshot validated. Enter the announced seed and confirm the final list to begin.";
    renderWheel(participants);
    resetDraw.disabled = false;
    resetResultList();
    updatePrizeCopy();
    updateActionState();
  } catch (error) {
    if (loadSequence !== state.fileLoadSequence) return;
    fileInput.value = "";
    state.csvBytes = null;
    state.participants = [];
    state.remainingParticipants = [];
    snapshotName.textContent = "File rejected";
    snapshotName.removeAttribute("title");
    snapshotHash.textContent = "—";
    snapshotHash.removeAttribute("title");
    wheelMode.textContent = "Frozen file required";
    wheelMessage.textContent = error instanceof Error ? error.message : "Unable to read CSV.";
    renderWheel(state.previewParticipants);
    updateActionState();
  }
};

const createConfetti = () => {
  const colors = ["#1f6b4b", "#d7a14b", "#a8c79c", "#bc713f", "#f5e5c5"];
  confetti.replaceChildren();

  for (let index = 0; index < 34; index += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${(index * 29) % 100}%`;
    piece.style.setProperty("--confetti-x", `${((index * 41) % 150) - 75}px`);
    piece.style.setProperty("--confetti-rotate", `${(index * 53) % 360}deg`);
    piece.style.setProperty("--confetti-delay", `${(index % 8) * 0.06}s`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    confetti.append(piece);
  }
};

const deterministicLanding = async (winner, roundIndex) => {
  const digest = await sha256Hex(
    JSON.stringify([
      DRAW_DOMAIN,
      ALGORITHM_VERSION,
      state.drawSession.audit.input.sha256,
      state.drawSeed,
      "wheel-landing",
      roundIndex + 1,
      winner.selected_ticket_sha256,
    ]),
  );
  const numerator = Number.parseInt(digest.slice(0, 12), 16);
  const unit = numerator / 0xffffffffffff;
  return {
    digest,
    fraction: 0.2 + unit * 0.6,
  };
};

const waitForSpin = (duration) =>
  new Promise((resolve) => {
    let finished = false;
    const settle = () => {
      if (finished) return;
      finished = true;
      rotator.removeEventListener("transitionend", settle);
      resolve();
    };
    rotator.addEventListener("transitionend", settle, { once: true });
    window.setTimeout(settle, duration + 500);
  });

const revealWinner = (winner, landing, segment, remainingTicketCount) => {
  const revealedAt = new Date().toISOString();
  state.pendingReveal = {
    ...winner,
    reveal_timestamp_utc: revealedAt,
    remaining_participants_before_round: state.remainingParticipants.length,
    remaining_tickets_before_round: remainingTicketCount,
    wheel_landing_sha256: landing.digest,
    wheel_landing_fraction: landing.fraction,
    wheel_landing_angle_degrees:
      segment.startDegrees + segment.spanDegrees * landing.fraction,
  };
  state.reveals.push(state.pendingReveal);

  const resultItem = resultItems[state.currentIndex];
  resultItem.className = "is-revealed";
  resultItem.querySelector("strong").textContent = winner.display_name;
  winnerPrize.textContent = winner.prize;
  winnerName.textContent = winner.display_name;
  winnerDetail.textContent = `${winner.ballots} ballot${winner.ballots === 1 ? "" : "s"} · selected ticket ${winner.selected_ticket_number}`;
  createConfetti();
  winnerDialog.showModal();
};

const startOrContinueSpin = async () => {
  if (state.spinning || state.currentIndex >= PRIZES.length) return;
  let generation = state.drawGeneration;

  try {
    if (!state.drawSession) {
      if (!state.csvBytes || !seedReference.value.trim() || !seedInput.value.trim()) {
        throw new TypeError("Load the final CSV and enter both seed fields first.");
      }
      if (!freezeConfirmation.checked) {
        throw new TypeError("Confirm that the ballot list is verified and frozen first.");
      }

      state.drawSeed = seedInput.value;
      state.seedSource = seedReference.value.trim();
      generation = ++state.drawGeneration;
      state.spinning = true;
      lockInputs();
      updateActionState();
      wheelMessage.textContent = "Hashing and locking all four results…";
      const drawSession = await conductDraw(state.csvBytes, state.drawSeed, {
        includeSeed: true,
      });
      if (generation !== state.drawGeneration) return;
      state.drawSession = drawSession;
      state.remainingParticipants = state.drawSession.participants.slice();
    }

    state.spinning = true;
    updateActionState();
    const winner = state.drawSession.winners[state.currentIndex];
    const segment = state.segments.find(
      (candidate) => candidate.participantId === winner.participant_id,
    );
    if (!segment) throw new Error("Selected participant is missing from the wheel.");

    const landing = await deterministicLanding(winner, state.currentIndex);
    if (generation !== state.drawGeneration) return;
    const landingAngle = segment.startDegrees + segment.spanDegrees * landing.fraction;
    const targetRotation = modulo(-landingAngle, 360);
    const currentRotation = modulo(state.rotation, 360);
    const alignment = modulo(targetRotation - currentRotation, 360);
    const reduceMotion = reducedMotion.matches;
    const duration = reduceMotion ? 0 : 7200;
    state.rotation += (reduceMotion ? 0 : 6 * 360) + alignment;
    rotator.style.transitionDuration = `${duration}ms`;
    wheelMessage.textContent = `Spinning for ${winner.prize}…`;

    if (reduceMotion) {
      rotator.style.transform = `rotate(${state.rotation}deg)`;
    } else {
      requestAnimationFrame(() => {
        rotator.style.transform = `rotate(${state.rotation}deg)`;
      });
      await waitForSpin(duration);
    }
    if (generation !== state.drawGeneration) return;

    revealWinner(winner, landing, segment, totalBallots(state.remainingParticipants));
  } catch (error) {
    if (generation !== state.drawGeneration) return;
    state.spinning = false;
    if (!state.drawSession) {
      state.drawSeed = "";
      state.seedSource = "";
      unlockInputs();
    }
    wheelMessage.textContent = error instanceof Error ? error.message : "Unable to start the draw.";
    updateActionState();
  }
};

const finalizeReveal = () => {
  if (!state.pendingReveal) return;
  const winnerId = state.pendingReveal.participant_id;
  state.remainingParticipants = state.remainingParticipants.filter(
    (participant) => participant.participantId !== winnerId,
  );
  state.pendingReveal = null;
  state.currentIndex += 1;
  state.spinning = false;

  rotator.style.transition = "none";
  state.rotation = 0;
  rotator.style.transform = "rotate(0deg)";
  void rotator.offsetWidth;
  rotator.style.transition = "";
  renderWheel(state.remainingParticipants);

  resultItems.forEach((item, index) => {
    if (index === state.currentIndex && state.currentIndex < PRIZES.length) {
      item.classList.add("is-current");
    }
  });
  updatePrizeCopy();

  if (state.currentIndex >= PRIZES.length) {
    downloadAudit.disabled = false;
    wheelSpin.disabled = true;
    spinButton.disabled = true;
  } else {
    wheelMessage.textContent = `${PRIZES[state.currentIndex]} is ready to reveal.`;
  }
  updateActionState();
};

const downloadCompletedAudit = async () => {
  if (!state.drawSession || state.currentIndex < PRIZES.length) return;

  downloadAudit.disabled = true;
  const selectionAudit = state.drawSession.audit;
  const ceremony = {
    source_reference: state.seedSource,
    completed_at_utc: state.reveals.at(-1)?.reveal_timestamp_utc || null,
    prize_order: [...PRIZES],
    reveals: state.reveals.map((reveal) => ({ ...reveal })),
  };
  try {
    const selectionAuditJson = stableAuditJson(selectionAudit);
    const auditEnvelope = {
      ceremony_schema_version: "1.0.0",
      selection_audit_sha256: await sha256Hex(selectionAuditJson),
      selection_audit: selectionAudit,
      ceremony,
    };
    const blob = new Blob([stableAuditJson(auditEnvelope)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rainforest-retreat-draw-audit.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    wheelMessage.textContent = error instanceof Error ? error.message : "Unable to export audit.";
  } finally {
    downloadAudit.disabled = !(state.drawSession && state.currentIndex >= PRIZES.length);
  }
};

const handleReset = () => {
  if (state.spinning) return;
  if (!state.drawSession) {
    clearDrawSession();
    return;
  }

  if (!state.resetArmed) {
    state.resetArmed = true;
    resetDraw.textContent = "Click again to confirm";
    state.resetTimer = window.setTimeout(() => {
      state.resetArmed = false;
      resetDraw.textContent = "Reset";
    }, 4000);
    return;
  }

  clearDrawSession();
};

fileInput.addEventListener("change", handleFile);
[seedReference, seedInput].forEach((field) => field.addEventListener("input", updateActionState));
freezeConfirmation.addEventListener("change", updateActionState);
spinButton.addEventListener("click", startOrContinueSpin);
wheelSpin.addEventListener("click", startOrContinueSpin);
downloadAudit.addEventListener("click", downloadCompletedAudit);
resetDraw.addEventListener("click", handleReset);
continueDraw.addEventListener("click", () => winnerDialog.close());
winnerDialog.addEventListener("close", finalizeReveal);

resetResultList();
updatePrizeCopy();
updateActionState();
loadPublicPreview();
