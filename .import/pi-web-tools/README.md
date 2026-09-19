# pi-web-tools

Small, owned web tools for [Pi](https://pi.dev):

- `web_search` uses OpenAI's native web search through the currently selected `openai-codex-responses` model and Pi's existing subscription OAuth credential.
- `web_fetch` downloads a public page and extracts readable HTML/text content without an LLM call.

No Ollama server or separate search API key is required.

## Requirements

- Pi 0.85.1 or newer
- An authenticated OpenAI Codex provider (`/login` in Pi)
- An active model whose API is `openai-codex-responses`
- Node.js 22 or newer

## Local install

```bash
pi install /Users/nhanchau/personal/pi/pi-web-tools
```

Restart Pi after first installation. During development, use `/reload` after editing extension files.

## Tools

### `web_search`

Takes one specific query. It uses the active Codex model, streams an answer, and returns provider-supplied source URLs. It deliberately does not fall back to another model or provider.

### `web_fetch`

Fetches one HTTP(S) URL and extracts HTML, plain text, JSON, XML, RSS, or Atom content. It:

- rejects credentials in URLs;
- blocks localhost and non-public IP ranges;
- validates each redirect;
- allows at most five redirects;
- limits downloads to 2 MiB;
- times out after 20 seconds;
- returns at most 50,000 extracted characters;
- marks fetched text as untrusted external content.

`web_fetch` is intentionally simple. It does not execute JavaScript, solve bot challenges, parse PDFs, or emulate a browser.

## Development

```bash
npm install
npm test
npm run typecheck
npm pack --dry-run
```

## License and provenance

MIT. The OpenAI Codex request/authentication approach was informed by the MIT-licensed [`pi-web-search`](https://github.com/ttttmr/pi-web-search) project. See [NOTICE.md](NOTICE.md).
