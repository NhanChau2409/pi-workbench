import type {
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { clampThinkingLevel, type Api, type Model } from "@earendil-works/pi-ai";
import { readSseEvents } from "./sse.ts";

export interface SearchSource {
  title: string;
  url: string;
}

export interface SearchResponse {
  text: string;
  sources: SearchSource[];
  queries: string[];
  model: string;
}

interface ResolvedAuth {
  ok: boolean;
  apiKey?: string;
  headers?: Record<string, string>;
  baseUrl?: string;
  error?: string;
}

function resolveResponsesUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/codex/responses")) return base;
  if (base.endsWith("/codex")) return `${base}/responses`;
  return `${base}/codex/responses`;
}

function extractAccountId(token: string): string {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) throw new Error("invalid token");
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    const accountId = payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
    if (typeof accountId !== "string" || !accountId) throw new Error("missing account ID");
    return accountId;
  } catch {
    throw new Error("Could not read the ChatGPT account ID from Pi's OpenAI Codex credential");
  }
}

function addUniqueSource(sources: SearchSource[], title: unknown, url: unknown): void {
  if (typeof url !== "string" || !url.startsWith("http")) return;
  if (sources.some((source) => source.url === url)) return;
  let fallback = url;
  try {
    fallback = new URL(url).hostname;
  } catch {
    // Keep URL as the fallback title.
  }
  sources.push({ title: typeof title === "string" && title ? title : fallback, url });
}

function collectResponseMetadata(
  response: any,
  sources: SearchSource[],
  queries: string[],
): string | undefined {
  let completedText: string | undefined;
  for (const item of response?.output ?? []) {
    if (item?.type === "web_search_call") {
      const action = item.action ?? {};
      const actionQueries = Array.isArray(action.queries)
        ? action.queries
        : typeof action.query === "string"
          ? [action.query]
          : [];
      for (const query of actionQueries) {
        if (typeof query === "string" && !queries.includes(query)) queries.push(query);
      }
      for (const source of action.sources ?? []) {
        addUniqueSource(sources, source?.title ?? source?.name, source?.url);
      }
      addUniqueSource(sources, undefined, action.url);
    }
    if (item?.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content?.type !== "output_text") continue;
      if (typeof content.text === "string") completedText = content.text;
      for (const annotation of content.annotations ?? []) {
        const citation = annotation?.url_citation ?? annotation;
        addUniqueSource(sources, citation?.title, citation?.url);
      }
    }
  }
  return completedText;
}

function requireCodexModel(ctx: ExtensionContext): Model<Api> {
  const model = ctx.model;
  if (!model) throw new Error("No model is selected");
  if (model.api !== "openai-codex-responses") {
    throw new Error(
      `web_search requires an OpenAI Codex Responses model; current model is ${model.provider}/${model.id} (${model.api})`,
    );
  }
  return model;
}

export async function searchWeb(
  query: string,
  ctx: ExtensionContext,
  signal: AbortSignal | undefined,
  onUpdate?: AgentToolUpdateCallback,
): Promise<SearchResponse> {
  const model = requireCodexModel(ctx);
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model) as ResolvedAuth;
  if (!auth.ok) throw new Error(auth.error ?? "Pi could not resolve OpenAI Codex authentication");

  const headers = new Headers(model.headers as Record<string, string> | undefined);
  for (const [name, value] of Object.entries(auth.headers ?? {})) headers.set(name, value);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  if (auth.apiKey && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.apiKey}`);
  }
  if (!headers.has("Authorization")) throw new Error("No OpenAI Codex OAuth credential is available");
  if (!headers.has("chatgpt-account-id")) {
    if (!auth.apiKey) throw new Error("No ChatGPT account ID is available");
    headers.set("chatgpt-account-id", extractAccountId(auth.apiKey));
  }
  if (!headers.has("originator")) headers.set("originator", "codex_cli_rs");

  const request: Record<string, unknown> = {
    model: model.id,
    input: [{ role: "user", content: [{ type: "input_text", text: query }] }],
    instructions: "Search the web and answer the request accurately. Cite primary sources when possible.",
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    parallel_tool_calls: true,
    stream: true,
    store: false,
    text: { verbosity: "low" },
  };
  if (model.reasoning && ctx.thinkingLevel && ctx.thinkingLevel !== "off") {
    const level = clampThinkingLevel(model, ctx.thinkingLevel);
    if (level !== "off") request.reasoning = { effort: model.thinkingLevelMap?.[level] ?? level };
  }

  onUpdate?.({
    content: [{ type: "text", text: `Searching the web for “${query}”…` }],
    details: { searching: true },
  });

  const response = await fetch(resolveResponsesUrl(auth.baseUrl ?? model.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 2_000);
    throw new Error(`OpenAI web search failed (${response.status}): ${message}`);
  }

  let text = "";
  const sources: SearchSource[] = [];
  const queries: string[] = [];

  await readSseEvents(response, signal, ({ data }) => {
    const event = data as any;
    if (event?.type === "error" || event?.type === "response.failed") {
      throw new Error(event?.message ?? event?.error?.message ?? event?.response?.error?.message ?? "OpenAI web search failed");
    }
    if (event?.type === "response.output_text.delta") {
      text += event.delta ?? "";
      onUpdate?.({
        content: [{ type: "text", text: text.slice(0, 20_000) }],
        details: { searching: true },
      });
    }
    if (event?.type === "response.output_text.annotation.added") {
      const citation = event.annotation?.url_citation ?? event.annotation;
      addUniqueSource(sources, citation?.title, citation?.url);
    }
    if (event?.type === "response.output_item.added" || event?.type === "response.output_item.done") {
      collectResponseMetadata({ output: [event.item] }, sources, queries);
    }
    if (event?.type === "response.completed" || event?.type === "response.done" || event?.type === "response.incomplete") {
      const completedText = collectResponseMetadata(event.response, sources, queries);
      if (!text && completedText) text = completedText;
      return true;
    }
  });

  if (!text.trim()) throw new Error("OpenAI web search returned no answer text");
  return { text: text.trim(), sources, queries, model: model.id };
}
