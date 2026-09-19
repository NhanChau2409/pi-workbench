import assert from "node:assert/strict";
import test from "node:test";
import { readSseEvents } from "../src/sse.ts";

test("reads JSON SSE events and stops when requested", async () => {
  const body = [
    "event: message",
    'data: {"type":"delta","text":"hello"}',
    "",
    'data: {"type":"done"}',
    "",
    'data: {"type":"ignored"}',
    "",
  ].join("\n");
  const response = new Response(body, { headers: { "content-type": "text/event-stream" } });
  const events: unknown[] = [];

  await readSseEvents(response, undefined, (event) => {
    events.push(event);
    return (event.data as { type?: string }).type === "done";
  });

  assert.deepEqual(events, [
    { event: "message", data: { type: "delta", text: "hello" } },
    { event: "", data: { type: "done" } },
  ]);
});

test("ignores malformed and DONE events", async () => {
  const response = new Response("data: not-json\n\ndata: [DONE]\n\n");
  const events: unknown[] = [];
  await readSseEvents(response, undefined, (event) => { events.push(event); });
  assert.deepEqual(events, []);
});
