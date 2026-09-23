import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import projectExtension from "../../extensions/project/index.ts";
import { projectPlanTemplate, projectVisionTemplate } from "../../extensions/project/domain.ts";
import { ProjectStore } from "../../extensions/project/store.ts";

type CommandDefinition = {
  getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null;
  handler: (args: string, ctx: any) => Promise<void>;
};

test("project command creates visible project context and lineage-aware work", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-extension-"));
  try {
    let command: CommandDefinition | undefined;
    const tools: Array<{ name: string; execute: (...args: any[]) => Promise<any> }> = [];
    const handlers = new Map<string, (event: any, ctx: any) => Promise<any>>();
    const messages: string[] = [];
    const entries: unknown[] = [];
    const pi = {
      registerCommand(name: string, definition: CommandDefinition) {
        if (name === "project") command = definition;
      },
      registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) {
        tools.push(definition);
      },
      on(name: string, handler: (event: any, ctx: any) => Promise<any>) {
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
    const statuses: Array<string | undefined> = [];
    const replacementEntries: unknown[] = [];
    let replacementMessage = "";
    const ctx = {
      cwd,
      hasUI: true,
      sessionManager: { getEntries: () => [], getSessionFile: () => "/tmp/parent.jsonl" },
      waitForIdle: async () => {},
      newSession: async (options: any) => {
        await options.setup({ appendCustomEntry: (_type: string, data: unknown) => replacementEntries.push(data) });
        await options.withSession({ sendUserMessage: async (message: string) => { replacementMessage = message; } });
        return { cancelled: false };
      },
      ui: {
        input: async () => undefined,
        select: async (_title: string, options: string[]) => options[0],
        notify: (message: string) => notifications.push(message),
        setStatus: (_id: string, value: string | undefined) => statuses.push(value),
      },
    };
    await handlers.get("session_start")?.({}, ctx);

    const completions = command.getArgumentCompletions?.("") ?? [];
    assert.deepEqual(completions.map((item) => item.value), [
      "status", "overview", "switch", "exit", "new", "explore", "work", "--help",
    ]);
    assert.deepEqual(tools.map((tool) => tool.name), ["project_checkpoint", "project_integrate"]);

    await command.handler("new Replace passwords with passkeys", ctx);
    const root = join(cwd, ".pi", "projects", "replace-passwords-with-passkeys");
    assert.equal(existsSync(join(root, "PROJECT.md")), true);
    assert.equal(existsSync(join(root, "PLAN.md")), true);
    assert.equal(existsSync(join(root, "project.json")), true);
    assert.equal(existsSync(join(root, "branches", "EXP-001-shape-project-direction.md")), true);
    assert.equal(entries.length > 0, true);
    assert.match(messages.at(-1) ?? "", /long-running project/);
    assert.match(statuses.at(-1) ?? "", /^Project Replace passwords with passkeys is on EXP-001 explore and is Waiting: Idle\.$/);

    await handlers.get("tool_execution_start")?.({ toolName: "bash", args: { command: "npm test" } }, ctx);
    assert.match(statuses.at(-1) ?? "", /is Verifying: Running verification\.$/);
    await handlers.get("agent_settled")?.({}, ctx);
    assert.match(statuses.at(-1) ?? "", /is Waiting: Idle\.$/);

    const store = new ProjectStore(cwd);
    const source = store.readBranch("replace-passwords-with-passkeys", "EXP-001");
    const integrate = tools.find((tool) => tool.name === "project_integrate");
    assert.ok(integrate);
    const integration = await integrate.execute("call-1", {
      branchMarkdown: source.markdown.replace("_Pending: adopt, reject, or continue exploring._", "Adopted."),
      projectMarkdown: projectVisionTemplate("Replace passwords with passkeys"),
      planMarkdown: projectPlanTemplate("Replace passwords with passkeys").replace(
        "Clarify the vision, outcome, and success evidence",
        "Run `/project work --from EXP-001 Implement registration`",
      ),
      outcome: "adopted",
      summary: "Registration direction adopted",
      decision: {
        title: "Use passkey registration",
        markdown: "## Decision\n\nProceed with passkey registration.",
      },
    }, undefined, undefined, ctx);
    assert.match(integration.content[0].text, /Recommended next command: \/project work --from EXP-001 Implement registration/);

    await command.handler("work --from EXP-001 Implement registration", ctx);
    const work = store.readBranch("replace-passwords-with-passkeys", "WORK-002");
    assert.equal(work.metadata.fromBranchId, "EXP-001");
    assert.deepEqual(work.metadata.sourceBranchIds, ["EXP-001"]);
    assert.deepEqual(work.metadata.sourceDecisionIds, ["DEC-001"]);
    assert.ok(work.metadata.relatedGoal);
    assert.ok(work.metadata.relatedMilestone);
    assert.match(messages.at(-1) ?? "", /EXP-001-shape-project-direction\.md/);
    assert.match(messages.at(-1) ?? "", /DEC-001-use-passkey-registration\.md/);

    await command.handler("status", ctx);
    assert.match(notifications.at(-1) ?? "", /Source lineage: EXP-001/);

    await command.handler("overview", ctx);
    assert.match(notifications.at(-1) ?? "", /branch context cleared/i);

    await command.handler("switch", ctx);
    assert.equal(replacementEntries.length, 1);
    assert.match(replacementMessage, /Read .*PROJECT\.md/);

    await command.handler("exit", ctx);
    assert.equal(statuses.at(-1), undefined);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
