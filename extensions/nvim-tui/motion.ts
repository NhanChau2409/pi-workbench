import { matchesKey } from "@earendil-works/pi-tui";

export type NvimWindow = "editor" | "transcript";

export type TranscriptMotion =
  | { kind: "line"; delta: number }
  | { kind: "halfPage"; delta: 1 | -1 }
  | { kind: "top" }
  | { kind: "bottom" }
  | { kind: "chunk"; delta: number }
  | { kind: "block"; delta: number };

export type MotionParseResult =
  | { action: "pending"; countBuffer: string }
  | { action: "motion"; motion: TranscriptMotion; countBuffer: string }
  | { action: "none"; countBuffer: string };

function countFrom(buffer: string): number {
  const parsed = Number.parseInt(buffer, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseTranscriptMotion(data: string, countBuffer = ""): MotionParseResult {
  if (/^[1-9]$/.test(data) || (countBuffer.length > 0 && data === "0")) {
    return { action: "pending", countBuffer: countBuffer + data };
  }

  const count = countFrom(countBuffer);
  const reset = "";

  if (data === "j") return { action: "motion", motion: { kind: "line", delta: count }, countBuffer: reset };
  if (data === "k") return { action: "motion", motion: { kind: "line", delta: -count }, countBuffer: reset };
  if (data === "g") return { action: "motion", motion: { kind: "top" }, countBuffer: reset };
  if (data === "G") return { action: "motion", motion: { kind: "bottom" }, countBuffer: reset };
  if (data === "]") return { action: "motion", motion: { kind: "chunk", delta: count }, countBuffer: reset };
  if (data === "[") return { action: "motion", motion: { kind: "chunk", delta: -count }, countBuffer: reset };
  if (data === "}") return { action: "motion", motion: { kind: "block", delta: count }, countBuffer: reset };
  if (data === "{") return { action: "motion", motion: { kind: "block", delta: -count }, countBuffer: reset };
  if (matchesKey(data, "ctrl+d")) return { action: "motion", motion: { kind: "halfPage", delta: 1 }, countBuffer: reset };
  if (matchesKey(data, "ctrl+u")) return { action: "motion", motion: { kind: "halfPage", delta: -1 }, countBuffer: reset };
  if (matchesKey(data, "ctrl+e")) return { action: "motion", motion: { kind: "line", delta: 1 }, countBuffer: reset };
  if (matchesKey(data, "ctrl+y")) return { action: "motion", motion: { kind: "line", delta: -1 }, countBuffer: reset };

  return { action: "none", countBuffer: reset };
}
