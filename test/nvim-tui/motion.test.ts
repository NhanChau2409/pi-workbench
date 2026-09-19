import assert from "node:assert/strict";
import test from "node:test";
import { parseTranscriptMotion } from "../../extensions/nvim-tui/motion.ts";

test("parses transcript line motions and counts", () => {
  assert.deepEqual(parseTranscriptMotion("j"), {
    action: "motion",
    motion: { kind: "line", delta: 1 },
    countBuffer: "",
  });

  const pending = parseTranscriptMotion("5");
  assert.deepEqual(pending, { action: "pending", countBuffer: "5" });
  assert.deepEqual(parseTranscriptMotion("j", pending.countBuffer), {
    action: "motion",
    motion: { kind: "line", delta: 5 },
    countBuffer: "",
  });
});

test("parses transcript page and top/bottom motions", () => {
  assert.deepEqual(parseTranscriptMotion("\x04"), {
    action: "motion",
    motion: { kind: "halfPage", delta: 1 },
    countBuffer: "",
  });
  assert.deepEqual(parseTranscriptMotion("\x15"), {
    action: "motion",
    motion: { kind: "halfPage", delta: -1 },
    countBuffer: "",
  });
  assert.deepEqual(parseTranscriptMotion("g").action, "motion");
  assert.deepEqual(parseTranscriptMotion("G"), {
    action: "motion",
    motion: { kind: "bottom" },
    countBuffer: "",
  });
});

test("parses transcript chunk and block motions", () => {
  assert.deepEqual(parseTranscriptMotion("]"), {
    action: "motion",
    motion: { kind: "chunk", delta: 1 },
    countBuffer: "",
  });
  assert.deepEqual(parseTranscriptMotion("["), {
    action: "motion",
    motion: { kind: "chunk", delta: -1 },
    countBuffer: "",
  });
  assert.deepEqual(parseTranscriptMotion("}"), {
    action: "motion",
    motion: { kind: "block", delta: 1 },
    countBuffer: "",
  });
  assert.deepEqual(parseTranscriptMotion("{"), {
    action: "motion",
    motion: { kind: "block", delta: -1 },
    countBuffer: "",
  });
});
