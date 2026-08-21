import assert from "node:assert/strict";
import { test } from "node:test";

import {
  conductDraw,
  parseParticipants,
  sha256Hex,
  stableAuditJson,
} from "../draw-engine.js";

const sampleCsv = new TextEncoder().encode(
  "participant_id,display_name,ballots\n" +
    "DEMO-001,Alex River,1\n" +
    "DEMO-002,Blair Forest,2\n" +
    "DEMO-003,Casey Fern,3\n" +
    "DEMO-004,Drew Canopy,4\n" +
    "DEMO-005,Emery Rain,5\n" +
    "DEMO-006,Frankie Moss,2\n",
);
const fixedSeed = "SYNTHETIC-SELF-TEST-SEED-NOT-FOR-A-LIVE-DRAW";

test("matches the Python known-answer vector", async () => {
  assert.equal(sampleCsv.byteLength, 173);
  const result = await conductDraw(sampleCsv, fixedSeed, {
    alternateCount: 2,
    includeSeed: true,
  });

  assert.equal(
    result.audit.input.sha256,
    "908b86a24bc9158bc5a47cab47769048d7ff4c226afd63a326c5eef85e175603",
  );
  assert.equal(
    result.audit.seed.sha256,
    "ac6d44e25a38ace972b8b54144bb0dd2c3210fdf8fe7464815127093fdb19e43",
  );
  assert.deepEqual(
    result.winners.map((winner) => [
      winner.participant_id,
      winner.selected_ticket_number,
      winner.selected_ticket_sha256,
      winner.sorted_ticket_position,
    ]),
    [
      [
        "DEMO-004",
        4,
        "1a3afff1f73b42e1f5fcfb8c8e4dd4acf142bb76496ffb6daa636ffc9768dac5",
        1,
      ],
      [
        "DEMO-002",
        2,
        "2b7c738fc1e6d1576cbecde5076a5788cada706896e4b68e07713dca65ade5b1",
        2,
      ],
      [
        "DEMO-005",
        3,
        "2ce162ba92438191ecae000121d963f4ac9583c11912ace25f0549c9fe701a94",
        4,
      ],
      [
        "DEMO-001",
        1,
        "423ac9088021cabf79d90044346d4528d9efc5b78573e762bcce23d01c649455",
        7,
      ],
    ],
  );

  assert.deepEqual(
    result.alternates.map((alternate) => [alternate.participant_id, alternate.sorted_ticket_position]),
    [
      ["DEMO-003", 9],
      ["DEMO-006", 11],
    ],
  );
  assert.equal(
    await sha256Hex(stableAuditJson(result.audit)),
    "37dd1d4a18fd790c49b1eae0587cfe06270eb203de794921229c2689179b65d3",
  );
});

test("is deterministic and never repeats a winner", async () => {
  const first = await conductDraw(sampleCsv, fixedSeed);
  const second = await conductDraw(sampleCsv, fixedSeed);
  assert.equal(stableAuditJson(first.audit), stableAuditJson(second.audit));
  assert.equal(new Set(first.winners.map((winner) => winner.participant_id)).size, 4);
});

test("hashes virtual tickets correctly across bounded batches", async () => {
  const batchedCsv = new TextEncoder().encode(
    "participant_id,display_name,ballots\n" +
      "A,One,130\nB,Two,120\nC,Three,110\nD,Four,100\n",
  );
  const result = await conductDraw(batchedCsv, "BATCH-TEST-SEED");
  assert.equal(result.tickets.length, 460);
  assert.equal(new Set(result.winners.map((winner) => winner.participant_id)).size, 4);
});

test("parses quoted fields and any exact header order", () => {
  const csv = new TextEncoder().encode(
    "ballots,display_name,participant_id\n" +
      '1,"River, Alex",ID-1\n' +
      "1,Blair,ID-2\n" +
      "1,Casey,ID-3\n" +
      "1,Drew,ID-4\n",
  );
  const participants = parseParticipants(csv);
  assert.equal(participants[0].displayName, "River, Alex");
  assert.equal(participants[0].participantId, "ID-1");
});

test("rejects duplicate IDs, invalid weights and too few people", () => {
  const bytes = (text) => new TextEncoder().encode(text);
  assert.throws(
    () =>
      parseParticipants(
        bytes(
          "participant_id,display_name,ballots\n" +
            "A,One,1\nA,Duplicate,2\nB,Two,1\nC,Three,1\nD,Four,1\n",
        ),
      ),
    /Duplicate participant_id/,
  );
  assert.throws(
    () =>
      parseParticipants(
        bytes(
          "participant_id,display_name,ballots\n" +
            "A,One,1\nB,Two,0\nC,Three,1\nD,Four,1\n",
        ),
      ),
    /positive safe integer/,
  );
  assert.throws(
    () =>
      parseParticipants(
        bytes("participant_id,display_name,ballots\nA,One,1\nB,Two,1\nC,Three,1\n"),
      ),
    /At least 4/,
  );
  assert.throws(
    () =>
      parseParticipants(
        bytes(
          "participant_id,display_name,ballots\n" +
            "A,One,9998\nB,Two,1\nC,Three,1\nD,Four,1\n",
        ),
      ),
    /10,000 virtual-ticket safety limit/,
  );
  assert.throws(
    () =>
      parseParticipants(
        bytes(
          "participant_id,display_name,ballots\n" +
            ",,\nA,One,1\nB,Two,1\nC,Three,1\nD,Four,1\n",
        ),
      ),
    /blank participant_id/,
  );
  assert.throws(
    () =>
      parseParticipants(
        bytes(
          "participant_id,display_name,ballots\n" +
            `${"A".repeat(129)},One,1\nB,Two,1\nC,Three,1\nD,Four,1\n`,
        ),
      ),
    /participant_id exceeds 128 UTF-8 bytes/,
  );
});

test("rejects an oversized seed before generating tickets", async () => {
  await assert.rejects(() => conductDraw(sampleCsv, "S".repeat(4097)), /4,096 UTF-8 bytes/);
});
