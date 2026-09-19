import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isViewportTUI, matchesKey, truncateToWidth, TuiAltScreen, type TUI } from "@earendil-works/pi-tui";
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

class NvimTuiEditor extends CustomEditor {
  private mode: Mode = "insert";
  private target: TargetWindow = "editor";
  private countBuffer = "";
  private pendingWindowCommand = false;

  constructor(
    private readonly appTui: TUI,
    theme: ConstructorParameters<typeof CustomEditor>[1],
    keybindings: ConstructorParameters<typeof CustomEditor>[2],
    private readonly updateStatus: (mode: Mode) => void,
  ) {
    super(appTui, theme, keybindings);
    this.updateStatus(this.mode);
  }

  handleInput(data: string): void {
    if (this.pendingWindowCommand) {
      this.pendingWindowCommand = false;
      if (data === "w") this.setTarget(this.target === "editor" ? "transcript" : "editor");
      else if (data === "k") this.setTarget("transcript");
      else if (data === "j") this.setTarget("editor");
      return;
    }

    if (matchesKey(data, "ctrl+w")) {
      this.pendingWindowCommand = true;
      return;
    }

    if (matchesKey(data, "escape")) {
      this.setMode("normal");
      return;
    }

    if (this.mode === "insert") {
      this.setTarget("editor");
      super.handleInput(data);
      return;
    }

    if (this.target === "transcript") {
      if (data === "i" || data === "a") {
        this.setTarget("editor");
        this.setMode("insert");
        if (data === "a") super.handleInput("\x1b[C");
        return;
      }
      this.handleTranscriptInput(data);
      return;
    }

    this.handleEditorNormalInput(data);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    const label = ` ${this.mode.toUpperCase()} `;
    const last = lines.length - 1;
    lines[last] = truncateToWidth(lines[last]!, Math.max(0, width - label.length), "") + label;
    return lines;
  }

  private handleEditorNormalInput(data: string): void {
    if (data in EDITOR_NORMAL_KEYS) {
      const seq = EDITOR_NORMAL_KEYS[data];
      if (data === "i") this.setMode("insert");
      else if (data === "a") {
        this.setMode("insert");
        super.handleInput("\x1b[C");
      } else if (seq) super.handleInput(seq);
      return;
    }

    if (data.length === 1 && data.charCodeAt(0) >= 32) return;
    super.handleInput(data);
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

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.updateStatus(this.mode);
    this.appTui.requestRender();
  }

  private setTarget(target: TargetWindow): void {
    this.target = target;
    this.updateStatus(this.mode);
    this.appTui.requestRender();
  }
}

export default function nvimTuiExtension(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new NvimTuiEditor(tui, theme, keybindings, (mode) => {
        ctx.ui.setStatus("nvim-tui", `[${mode.toUpperCase()}]`);
      }),
    );
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setStatus("nvim-tui", undefined);
    ctx.ui.setEditorComponent(undefined);
  });
}
