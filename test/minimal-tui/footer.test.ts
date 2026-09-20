import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { layoutMinimalFooter } from "../../extensions/minimal-tui/footer.ts";

test("right-aligns model and thinking in the footer", () => {
  assert.equal(
    layoutMinimalFooter(24, "gpt-5.5 · high"),
    "          gpt-5.5 · high",
  );
});

test("keeps styled footer within terminal width", () => {
  const line = layoutMinimalFooter(12, "\u001b[2mgpt-5.5\u001b[22m · high");
  assert.equal(visibleWidth(line), 12);
});
