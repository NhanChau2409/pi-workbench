import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  decodeKittyPrintable,
  isViewportTUI,
  matchesKey,
  truncateToWidth,
  TuiAltScreen,
  type TUI,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { parseTranscriptMotion } from "./motion.ts";
import { applyTranscriptMotion } from "./transcript.ts";

type Mode = "insert" | "normal";
type TargetWindow = "editor" | "transcript";

const EDITOR_NORMAL_KEYS: Record<string, string | null> = {
  h: "\x1b[D",
  j: "\x1b[B",
  k: "\x1b[A",
  l: "\x1b[C",
  "0": "\x01",
  $: "\x05",
  x: "\x1b[3~",
  i: null,
  a: null,
};

class InteractionState {
  mode: Mode = "insert";
  target: TargetWindow = "editor";
  private listeners = new Set<() => void>();

  set(mode: Mode, target: TargetWindow): void {
    if (this.mode === mode && this.target === target) return;
    this.mode = mode;
    this.target = target;
    for (const listener of this.listeners) listener();
  }

  setMode(mode: Mode): void {
    this.set(mode, this.target);
  }

  setTarget(target: TargetWindow): void {
    this.set(this.mode, target);
  }

  toggleTarget(): void {
    this.setTarget(this.target === "editor" ? "transcript" : "editor");
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class NvimTuiEditor extends CustomEditor {
  private countBuffer = "";

  constructor(
    private readonly appTui: TUI,
    theme: ConstructorParameters<typeof CustomEditor>[1],
    keybindings: ConstructorParameters<typeof CustomEditor>[2],
    private readonly interaction: InteractionState,
  ) {
    super(appTui, theme, keybindings);
  }

  handleInput(data: string): void {
    const printable = decodeKittyPrintable(data) ?? data;

    if (matchesKey(data, "ctrl+]")) {
      if (this.interaction.target === "editor") this.interaction.set("normal", "transcript");
      else this.interaction.setTarget("editor");
      return;
    }

    if (matchesKey(data, "escape")) {
      this.interaction.set("normal", "editor");
      return;
    }

    if (this.interaction.mode === "insert") {
      this.interaction.setTarget("editor");
      super.handleInput(data);
      return;
    }

    if (this.interaction.target === "transcript") {
      if (printable === "i" || printable === "a") {
        this.interaction.set("insert", "editor");
        if (printable === "a") super.handleInput("\x1b[C");
        return;
      }
      this.handleTranscriptInput(printable === data ? data : printable);
      return;
    }

    this.handleEditorNormalInput(printable, data);
  }

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    if (event.button === "left" && (event.type === "press" || event.type === "click")) {
      this.interaction.setTarget("editor");
    }
    return super.handleMouse(event);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    const label = ` ${this.interaction.mode.toUpperCase()} `;
    const last = lines.length - 1;
    lines[last] = truncateToWidth(lines[last]!, Math.max(0, width - label.length), "") + label;
    return lines;
  }

  private handleEditorNormalInput(key: string, rawData: string): void {
    if (key in EDITOR_NORMAL_KEYS) {
      const seq = EDITOR_NORMAL_KEYS[key];
      if (key === "i") this.interaction.setMode("insert");
      else if (key === "a") {
        this.interaction.setMode("insert");
        super.handleInput("\x1b[C");
      } else if (seq) super.handleInput(seq);
      return;
    }

    if (key.length === 1 && key.charCodeAt(0) >= 32) return;
    super.handleInput(rawData);
  }

  private handleTranscriptInput(data: string): void {
    const parsed = parseTranscriptMotion(data, this.countBuffer);
    this.countBuffer = parsed.countBuffer;
    if (parsed.action !== "motion") return;

    if (!(this.appTui instanceof TuiAltScreen) && !isViewportTUI(this.appTui)) return;

    const halfPageLines = Math.max(1, Math.floor(this.appTui.terminal.rows / 2));
    applyTranscriptMotion(this.appTui as TuiAltScreen, parsed.motion, {
      halfPageLines,
      chunkLines: halfPageLines,
      blockLines: Math.max(3, Math.floor(halfPageLines / 2)),
    });
    this.appTui.requestRender();
  }
}

export default function nvimTuiExtension(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const interaction = new InteractionState();

    ctx.ui.setWidget("nvim-tui-transcript-ruler", (tui, theme) => {
      const unsubscribe = interaction.subscribe(() => tui.requestRender());
      return {
        render(width: number): string[] {
          const active = interaction.target === "transcript";
          const label = active ? " TRANSCRIPT • NORMAL " : " transcript · Ctrl-] to focus ";
          const side = "─".repeat(Math.max(0, Math.floor((width - label.length) / 2)));
          const line = truncateToWidth(`${side}${label}${side}`, width, "");
          return [theme.fg(active ? "accent" : "dim", line)];
        },
        handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
          if (event.button !== "left" || (event.type !== "press" && event.type !== "click")) return undefined;
          interaction.set("normal", "transcript");
          return { handled: true, render: true };
        },
        invalidate() {},
        dispose: unsubscribe,
      };
    });

    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new NvimTuiEditor(tui, theme, keybindings, interaction),
    );
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setWidget("nvim-tui-transcript-ruler", undefined);
    ctx.ui.setEditorComponent(undefined);
  });
}
