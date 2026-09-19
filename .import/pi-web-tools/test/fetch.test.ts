import assert from "node:assert/strict";
import test from "node:test";
import { extractReadableContent } from "../src/fetch.ts";

test("extracts readable HTML and omits scripts and navigation", () => {
  const result = extractReadableContent(`
    <html>
      <head><title> Example &amp; Test </title><style>.x { color: red }</style></head>
      <body>
        <nav>Menu item</nav>
        <main><h1>Hello</h1><p>Useful content.</p><a href="https://example.com">Reference</a></main>
        <script>alert('ignore me')</script>
        <footer>Copyright</footer>
      </body>
    </html>
  `, "text/html");

  assert.equal(result.title, "Example & Test");
  assert.match(result.text, /Hello/i);
  assert.match(result.text, /Useful content/);
  assert.match(result.text, /Reference/);
  assert.doesNotMatch(result.text, /Menu item|ignore me|Copyright|https:\/\/example\.com/);
});

test("returns plain text unchanged except surrounding whitespace", () => {
  assert.deepEqual(extractReadableContent("  hello\nworld  ", "text/plain"), { text: "hello\nworld" });
});

test("rejects binary content", () => {
  assert.throws(() => extractReadableContent("bytes", "application/pdf"), /Unsupported content type/);
});
