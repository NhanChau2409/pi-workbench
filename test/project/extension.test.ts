import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import projectExtension from "../../extensions/project/index.ts";

type CommandDefinition = {
  getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null;
  handler: (args: string, ctx: any) => Promise<void>;
};

test("project command exposes a small interface and creates editor-friendly project files", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-extension-"));
  try {
    let command: CommandDefinition | undefined;
    const tools: string[] = [];
    const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void>>();
    const messages: string[] = [];
    const entries: unknown[] = [];
    const pi = {
      registerCommand(name: string, definition: CommandDefinition) {
        if (name === "project") command = definition;
      },
      registerTool(definition: { name: string }) {
        tools.push(definition.name);
      },
      on(name: string, handler: (event: unknown, ctx: any) => Promise<void>) {
        handlers.set(name, handler);
      },
      appendEntry(_type: string, data: unknown) {
        entries.push(data);
      },
      sendUserMessage(message: string) {
        messages.push(message);
      },
    };
    projectExtension(pi as any);
    assert.ok(command);

    const notifications: string[] = [];
    const ctx = {
      cwd,
      hasUI: true,
      sessionManager: { getEntries: () => [] },
      ui: {
        input: async () => undefined,
        select: async (_title: string, options: string[]) => options[0],
        notify: (message: string) => notifications.push(message),
      },
    };
    await handlers.get("session_start")?.({}, ctx);

    const completions = command.getArgumentCompletions?.("") ?? [];
    assert.deepEqual(completions.map((item) => item.value), ["new", "explore", "work", "--help"]);
    assert.deepEqual(tools, ["project_checkpoint", "project_integrate"]);

    await command.handler("new Replace passwords with passkeys", ctx);
    const root = join(cwd, ".pi", "projects", "replace-passwords-with-passkeys");
    assert.equal(existsSync(join(root, "PLAN.md")), true);
    assert.equal(existsSync(join(root, "project.json")), true);
    assert.equal(existsSync(join(root, "branches", "EXP-001-shape-project-direction.md")), true);
    assert.equal(entries.length > 0, true);
    assert.match(messages.at(-1) ?? "", /long-running project/);

    await command.handler("explore Test account recovery", ctx);
    assert.equal(existsSync(join(root, "branches", "EXP-002-test-account-recovery.md")), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
