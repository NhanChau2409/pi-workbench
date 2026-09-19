import { convert } from "html-to-text";
import { validatePublicUrl } from "./network.ts";

const DEFAULT_MAX_CHARS = 30_000;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 20_000;

export interface FetchPageOptions {
  maxChars?: number;
  signal?: AbortSignal;
}

export interface FetchedPage {
  url: string;
  status: number;
  contentType: string;
  title?: string;
  text: string;
  downloadedBytes: number;
  truncated: boolean;
}

function decodeHtmlText(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? convert(titleMatch[1], { wordwrap: false }).replace(/\s+/g, " ").trim() || undefined
    : undefined;
  const text = convert(html, {
    wordwrap: false,
    preserveNewlines: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "noscript", format: "skip" },
      { selector: "svg", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text };
}

export function extractReadableContent(body: string, contentType: string): { title?: string; text: string } {
  if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
    return decodeHtmlText(body);
  }
  if (
    contentType.startsWith("text/")
    || contentType.includes("application/json")
    || contentType.includes("application/xml")
    || contentType.includes("application/rss+xml")
    || contentType.includes("application/atom+xml")
  ) {
    return { text: body.trim() };
  }
  throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
}

async function readLimitedBody(response: Response): Promise<{ body: string; bytes: number }> {
  if (!response.body) throw new Error("Response had no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_DOWNLOAD_BYTES) {
        throw new Error(`Page exceeded the ${MAX_DOWNLOAD_BYTES}-byte download limit`);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return { body, bytes };
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Reader may already be closed.
    }
    reader.releaseLock();
  }
}

export async function fetchPage(rawUrl: string, options: FetchPageOptions = {}): Promise<FetchedPage> {
  const maxChars = Math.max(1_000, Math.min(options.maxChars ?? DEFAULT_MAX_CHARS, 50_000));
  const timeout = new AbortController();
  const timeoutId = setTimeout(() => timeout.abort(new Error("web_fetch timed out")), REQUEST_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout.signal])
    : timeout.signal;

  try {
    let url = await validatePublicUrl(rawUrl);

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html, text/plain, application/json, application/xml;q=0.9, */*;q=0.1",
          "User-Agent": "pi-web-tools/0.1 (+https://github.com/NhanChau2409)",
        },
        redirect: "manual",
        signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Redirect from ${url} had no Location header`);
        if (redirects === MAX_REDIRECTS) throw new Error(`Too many redirects while fetching ${rawUrl}`);
        await response.body?.cancel();
        url = await validatePublicUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
      }

      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > MAX_DOWNLOAD_BYTES) {
        await response.body?.cancel();
        throw new Error(`Page exceeds the ${MAX_DOWNLOAD_BYTES}-byte download limit`);
      }

      const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      const { body, bytes } = await readLimitedBody(response);
      const readable = extractReadableContent(body, contentType);
      const truncated = readable.text.length > maxChars;
      const text = truncated ? `${readable.text.slice(0, maxChars)}\n\n[Content truncated]` : readable.text;

      return {
        url: url.toString(),
        status: response.status,
        contentType,
        title: readable.title,
        text,
        downloadedBytes: bytes,
        truncated,
      };
    }

    throw new Error(`Too many redirects while fetching ${rawUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
