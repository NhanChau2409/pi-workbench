import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import livingPlanExtension from "../../extensions/plan-mode/index.ts";

type CommandDefinition = {
  getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
  handler: (args: string, ctx: any) => Promise<void>;
};

test("plan command suggests subcommands and saved plans and exposes help", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-plan-"));
  const plansDir = join(cwd, ".pi", "plans");
  mkdirSync(plansDir, { recursive: true });
  writeFileSync(join(plansDir, "2026-09-19-example.md"), "# Example\n", "utf8");

  let command: CommandDefinition | undefined;
  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void>>();
  const pi = {
    registerTool() {},
    registerCommand(name: string, definition: CommandDefinition) {
      if (name === "plan") command = definition;
    },
    on(name: string, handler: (event: unknown, ctx: any) => Promise<void>) {
      handlers.set(name, handler);
    },
  };

  livingPlanExtension(pi as any);
  assert.ok(command);

  const notifications: string[] = [];
  const ctx = {
    cwd,
    sessionManager: { getEntries: () => [] },
    ui: {
      notify: (message: string) => notifications.push(message),
      setStatus() {},
      setWidget() {},
    },
  };
  await handlers.get("session_start")?.({}, ctx);

  const subcommands = command.getArgumentCompletions?.("") ?? [];
  assert.ok(subcommands.some((item) => item.value === "list"));
  assert.ok(subcommands.some((item) => item.value === "--help"));

  const plans = command.getArgumentCompletions?.("resume example") ?? [];
  assert.deepEqual(plans.map((item) => item.value), ["resume 2026-09-19-example.md"]);

  await command.handler("--help", ctx);
  assert.match(notifications.at(-1) ?? "", /Usage: \/plan/);
  assert.match(notifications.at(-1) ?? "", /resume \[plan-file\]/);

  rmSync(cwd, { recursive: true, force: true });
});
