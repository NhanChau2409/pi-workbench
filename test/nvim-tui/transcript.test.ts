import assert from "node:assert/strict";
import test from "node:test";
import { applyTranscriptMotion, type TranscriptScroller } from "../../extensions/nvim-tui/transcript.ts";

function fakeScroller(): TranscriptScroller & { calls: Array<[string, number?]> } {
  const calls: Array<[string, number?]> = [];
  return {
    calls,
    scrollBy(lines: number) {
      calls.push(["scrollBy", lines]);
    },
    scrollToTop() {
      calls.push(["scrollToTop"]);
    },
    scrollToBottom() {
      calls.push(["scrollToBottom"]);
    },
  };
}

test("applies transcript line, half-page, top, and bottom motions", () => {
  const scroller = fakeScroller();

  applyTranscriptMotion(scroller, { kind: "line", delta: 5 });
  applyTranscriptMotion(scroller, { kind: "halfPage", delta: -1 }, { halfPageLines: 12 });
  applyTranscriptMotion(scroller, { kind: "top" });
  applyTranscriptMotion(scroller, { kind: "bottom" });

  assert.deepEqual(scroller.calls, [
    ["scrollBy", 5],
    ["scrollBy", -12],
    ["scrollToTop"],
    ["scrollToBottom"],
  ]);
});

test("applies chunk motions through navigator when available", () => {
  const scroller = fakeScroller();
  const calls: Array<[string, number]> = [];
  const chunkNavigator = {
    previous: (count: number) => calls.push(["previous", count]),
    next: (count: number) => calls.push(["next", count]),
  };

  applyTranscriptMotion(scroller, { kind: "chunk", delta: 2 }, { chunkNavigator });
  applyTranscriptMotion(scroller, { kind: "chunk", delta: -1 }, { chunkNavigator });

  assert.deepEqual(calls, [["next", 2], ["previous", 1]]);
  assert.deepEqual(scroller.calls, []);
});

test("falls back for chunk and block motions without semantic navigators", () => {
  const scroller = fakeScroller();

  applyTranscriptMotion(scroller, { kind: "chunk", delta: 2 }, { chunkLines: 20 });
  applyTranscriptMotion(scroller, { kind: "block", delta: -1 }, { blockLines: 6 });

  assert.deepEqual(scroller.calls, [["scrollBy", 40], ["scrollBy", -6]]);
});
