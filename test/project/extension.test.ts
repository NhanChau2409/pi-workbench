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

test("project command manages a simple document and record folders", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-extension-"));
  try {
    let command: CommandDefinition | undefined;
    const handlers = new Map<string, (event: any, ctx: any) => Promise<any>>();
    const statuses: Array<string | undefined> = [];
    const notifications: string[] = [];
    const messages: string[] = [];
    const entries: unknown[] = [];
    const pi = {
      registerCommand(name: string, definition: CommandDefinition) {
        if (name === "project") command = definition;
      },
      on(name: string, handler: (event: any, ctx: any) => Promise<any>) {
        handlers.set(name, handler);
      },
      appendEntry(_type: string, data: unknown) { entries.push(data); },
      sendUserMessage(message: string) { messages.push(message); },
    };
    projectExtension(pi as any);
    assert.ok(command);

    const ctx = {
      cwd,
      hasUI: true,
      sessionManager: { getEntries: () => [] },
      ui: {
        input: async () => undefined,
        select: async (_title: string, options: string[]) => options[0],
        notify: (message: string) => notifications.push(message),
        setStatus: (_id: string, value: string | undefined) => statuses.push(value),
        theme: { fg: (_color: string, value: string) => `grey:${value}` },
      },
    };
    await handlers.get("session_start")?.({}, ctx);

    assert.deepEqual((command.getArgumentCompletions?.("") ?? []).map((item) => item.value), [
      "new", "open", "status", "explore", "work", "exit", "--help",
    ]);
    await command.handler("new Build a personal agent", ctx);
    const root = join(cwd, ".pi", "projects", "build-a-personal-agent");
    assert.equal(existsSync(join(root, "PROJECT.md")), true);
    assert.equal(existsSync(join(root, "explore")), true);
    assert.equal(existsSync(join(root, "work")), true);
    assert.match(statuses.at(-1) ?? "", /^grey:Project Build a personal agent: Not started\.$/);
    assert.match(messages.at(-1) ?? "", /PROJECT\.md/);

    await command.handler("explore Compare chat channels", ctx);
    assert.match(notifications.at(-1) ?? "", /explore\/.*compare-chat-channels\.md$/);
    assert.match(messages.at(-1) ?? "", /exploration record/);
    assert.equal(statuses.at(-1), "grey:Build a personal agent · Explore · Compare chat channels");

    await command.handler("work Build Telegram integration", ctx);
    assert.match(notifications.at(-1) ?? "", /work\/.*build-telegram-integration\.md$/);
    assert.match(messages.at(-1) ?? "", /implementation record/);
    assert.equal(statuses.at(-1), "grey:Build a personal agent · Work · Build Telegram integration");

    await command.handler("status", ctx);
    assert.match(notifications.at(-1) ?? "", /Project document: .*PROJECT\.md/);
    await command.handler("exit", ctx);
    assert.equal(statuses.at(-1), undefined);
    assert.ok(entries.length > 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
