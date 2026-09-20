import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { layoutMinimalFooter } from "./footer.ts";

export default function minimalTuiExtension(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setFooter((_tui, theme) => ({
      invalidate() {},
      render(width: number): string[] {
        const model = theme.fg("dim", ctx.model?.id ?? "no model");
        const thinking = theme.fg("accent", ctx.thinkingLevel ?? "off");
        return [layoutMinimalFooter(width, `${model}${theme.fg("dim", " · ")}${thinking}`)];
      },
    }));
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
  });
}
