export const DRAW_DOMAIN = "sg.rainforest-retreat.giveaway.weighted-draw";
export const ALGORITHM_VERSION = "1.0.0";
export const AUDIT_SCHEMA_VERSION = "1.0.0";
export const PRIZES = ["Grand Prize", "Gift Prize 1", "Gift Prize 2", "Gift Prize 3"];
export const MAX_VIRTUAL_TICKETS = 10_000;
export const MAX_PARTICIPANT_ID_BYTES = 128;
export const MAX_DISPLAY_NAME_BYTES = 256;
export const MAX_SEED_BYTES = 4_096;

const REQUIRED_COLUMNS = ["participant_id", "display_name", "ballots"];
const INTEGER_PATTERN = /^[+-]?[0-9]+$/;
const encoder = new TextEncoder();

const compareText = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const normalizeCell = (value) => String(value ?? "").trim().normalize("NFC");
const utf8Length = (value) => encoder.encode(value).byteLength;

const toBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("Draw input must be CSV bytes.");
};

export const sha256Hex = async (value) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : toBytes(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new TypeError("CSV contains an unterminated quoted field.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
};

export const parseParticipants = (csvInput) => {
  const csvBytes = toBytes(csvInput);
  let text;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(csvBytes);
  } catch {
    throw new TypeError("Input CSV must be valid UTF-8.");
  }

  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (!text.trim()) throw new TypeError("Input CSV is empty.");

  const rows = parseCsvRows(text);
  if (!rows.length) throw new TypeError("Input CSV has no header row.");

  const headers = rows[0].map(normalizeCell);
  if (headers.some((header) => !header)) {
    throw new TypeError("CSV header contains a blank column name.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new TypeError("CSV header contains duplicate column names.");
  }
  if (
    headers.length !== REQUIRED_COLUMNS.length ||
    REQUIRED_COLUMNS.some((column) => !headers.includes(column))
  ) {
    throw new TypeError(`CSV header must contain exactly: ${REQUIRED_COLUMNS.join(",")}`);
  }

  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const participants = [];
  const seenIds = new Map();
  let virtualTicketCount = 0;

  rows.slice(1).forEach((cells, rowOffset) => {
    const lineNumber = rowOffset + 2;
    if (cells.length !== headers.length) {
      throw new TypeError(`CSV row ${lineNumber} must contain exactly three columns.`);
    }

    const participantId = normalizeCell(cells[columnIndex.participant_id]);
    const displayName = normalizeCell(cells[columnIndex.display_name]);
    const ballotsText = normalizeCell(cells[columnIndex.ballots]);

    if (!participantId) throw new TypeError(`CSV row ${lineNumber} has a blank participant_id.`);
    if (!displayName) throw new TypeError(`CSV row ${lineNumber} has a blank display_name.`);
    if (!ballotsText) throw new TypeError(`CSV row ${lineNumber} has blank ballots.`);
    if (utf8Length(participantId) > MAX_PARTICIPANT_ID_BYTES) {
      throw new TypeError(
        `CSV row ${lineNumber} participant_id exceeds ${MAX_PARTICIPANT_ID_BYTES} UTF-8 bytes.`,
      );
    }
    if (utf8Length(displayName) > MAX_DISPLAY_NAME_BYTES) {
      throw new TypeError(
        `CSV row ${lineNumber} display_name exceeds ${MAX_DISPLAY_NAME_BYTES} UTF-8 bytes.`,
      );
    }
    if (seenIds.has(participantId)) {
      throw new TypeError(
        `Duplicate participant_id ${participantId} on rows ${seenIds.get(participantId)} and ${lineNumber}.`,
      );
    }
    if (!INTEGER_PATTERN.test(ballotsText)) {
      throw new TypeError(`CSV row ${lineNumber} ballots must be an integer.`);
    }

    const ballots = Number(ballotsText);
    if (!Number.isSafeInteger(ballots) || ballots <= 0) {
      throw new TypeError(`CSV row ${lineNumber} ballots must be a positive safe integer.`);
    }

    virtualTicketCount += ballots;
    if (virtualTicketCount > MAX_VIRTUAL_TICKETS) {
      throw new TypeError(
        `CSV exceeds the ${MAX_VIRTUAL_TICKETS.toLocaleString("en-US")} virtual-ticket safety limit.`,
      );
    }

    seenIds.set(participantId, lineNumber);
    participants.push({ participantId, displayName, ballots });
  });

  if (participants.length < PRIZES.length) {
    throw new TypeError(`At least ${PRIZES.length} unique eligible participants are required.`);
  }

  return participants;
};

const ticketPayload = ({ inputSha256, seed, participantId, ticketNumber }) =>
  JSON.stringify([
    DRAW_DOMAIN,
    ALGORITHM_VERSION,
    inputSha256,
    seed,
    participantId,
    ticketNumber,
  ]);

export const buildSortedTickets = async (participants, inputSha256, seed) => {
  const tickets = [];
  let ticketPromises = [];
  const flushBatch = async () => {
    if (!ticketPromises.length) return;
    tickets.push(...(await Promise.all(ticketPromises)));
    ticketPromises = [];
  };

  for (const participant of participants) {
    for (let ticketNumber = 1; ticketNumber <= participant.ballots; ticketNumber += 1) {
      ticketPromises.push(
        sha256Hex(
          ticketPayload({
            inputSha256,
            seed,
            participantId: participant.participantId,
            ticketNumber,
          }),
        ).then((ticketSha256) => ({
          ticketSha256,
          participantId: participant.participantId,
          ticketNumber,
        })),
      );
      if (ticketPromises.length >= 256) await flushBatch();
    }
  }
  await flushBatch();

  return tickets.sort(
    (left, right) =>
      compareText(left.ticketSha256, right.ticketSha256) ||
      compareText(left.participantId, right.participantId) ||
      left.ticketNumber - right.ticketNumber,
  );
};

export const conductDraw = async (
  csvInput,
  seed,
  { alternateCount = 0, includeSeed = true } = {},
) => {
  if (typeof seed !== "string" || !seed.trim()) {
    throw new TypeError("A non-blank draw seed is required.");
  }
  if (utf8Length(seed) > MAX_SEED_BYTES) {
    throw new TypeError(`Draw seed exceeds ${MAX_SEED_BYTES.toLocaleString("en-US")} UTF-8 bytes.`);
  }
  if (!Number.isSafeInteger(alternateCount) || alternateCount < 0) {
    throw new TypeError("Alternate count must be a non-negative integer.");
  }

  const csvBytes = toBytes(csvInput);
  const participants = parseParticipants(csvBytes);
  const maximumAlternates = participants.length - PRIZES.length;
  if (alternateCount > maximumAlternates) {
    throw new TypeError(`Only ${maximumAlternates} alternates are available after four winners.`);
  }

  const inputSha256 = await sha256Hex(csvBytes);
  const seedSha256 = await sha256Hex(seed);
  const tickets = await buildSortedTickets(participants, inputSha256, seed);
  const participantById = new Map(
    participants.map((participant) => [participant.participantId, participant]),
  );
  const selectedIds = new Set();
  const winners = [];
  const alternates = [];

  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    if (selectedIds.has(ticket.participantId)) continue;

    const participant = participantById.get(ticket.participantId);
    const record = {
      participant_id: participant.participantId,
      display_name: participant.displayName,
      ballots: participant.ballots,
      selected_ticket_number: ticket.ticketNumber,
      selected_ticket_sha256: ticket.ticketSha256,
      sorted_ticket_position: index + 1,
    };
    selectedIds.add(ticket.participantId);

    if (winners.length < PRIZES.length) {
      record.prize = PRIZES[winners.length];
      record.winner_rank = winners.length + 1;
      winners.push(record);
    } else if (alternates.length < alternateCount) {
      record.alternate_rank = alternates.length + 1;
      alternates.push(record);
    }

    if (winners.length === PRIZES.length && alternates.length === alternateCount) break;
  }

  const seedRecord = {
    sha256: seedSha256,
    encoding: "UTF-8",
    included_in_audit: includeSeed,
  };
  if (includeSeed) seedRecord.value = seed;

  const audit = {
    audit_schema_version: AUDIT_SCHEMA_VERSION,
    algorithm: {
      name: "SHA-256 virtual-ticket weighted draw without replacement",
      version: ALGORITHM_VERSION,
      domain: DRAW_DOMAIN,
      ticket_payload:
        "UTF-8 JSON array [domain,algorithm_version,input_sha256,seed,participant_id,ticket_number], unescaped non-ASCII and compact separators",
      ticket_numbering: "1-based within each participant",
      ticket_order:
        "lexicographic ticket SHA-256 ascending; participant_id then ticket_number break a theoretical hash tie",
      selection_rule:
        "scan ticket order; award Grand Prize then Gift Prizes 1-3 to the first four unique participant IDs; skip already selected IDs",
    },
    input: {
      sha256: inputSha256,
      sha256_scope: "exact input CSV bytes",
      participant_count: participants.length,
      total_virtual_tickets: tickets.length,
    },
    seed: seedRecord,
    winners,
    alternates,
  };

  return { audit, participants, tickets, winners, alternates };
};

const sortObjectKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareText)
        .map((key) => [key, sortObjectKeys(value[key])]),
    );
  }
  return value;
};

export const stableAuditJson = (audit) => `${JSON.stringify(sortObjectKeys(audit), null, 2)}\n`;
