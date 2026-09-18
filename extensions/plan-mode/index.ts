import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type PlanMode = "explore" | "experiment" | "work" | "paused";

type Goal = {
  index: number;
  text: string;
  done: boolean;
  evidence?: string;
};

type PlanState = {
  active: boolean;
  mode: PlanMode;
  topic?: string;
  planPath?: string;
  markdown?: string;
  focus?: string;
  goals: Goal[];
  toolsBeforePlan?: string[];
  checkpoint: number;
};

const STATE_ENTRY = "local-living-plan-state";
const WRITE_TOOLS = new Set(["edit", "write"]);
const PLAN_TOOLS = ["plan_checkpoint", "plan_goal_done"];
const SAFE_COMMANDS = new Set([
  "pwd", "ls", "find", "fd", "rg", "grep", "cat", "head", "tail", "wc", "tree",
  "git", "npm", "pnpm", "yarn", "node", "python", "python3", "cargo", "go",
]);

function emptyState(): PlanState {
  return { active: false, mode: "paused", goals: [], checkpoint: 0 };
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "plan";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialPlan(topic: string): string {
  return `# ${topic}\n\n## Desired state\n\n_To clarify together._\n\n## Constraints and non-goals\n\n_To clarify together._\n\n## Mental model / architecture\n\n_To develop after the desired state is clear._\n\n## Current focus\n\nClarify the desired state.\n\n## Goals\n\n- [ ] Clarify desired state, constraints, and success criteria\n- [ ] Establish the big-picture mental model or architecture\n- [ ] Split the work into meaningful, testable goals\n\n## Decisions and checkpoints\n\n### Checkpoint 0 — Plan opened\n\nThe plan is a living artifact. Exploration, disposable experiments, and implementation may update our understanding without losing the desired state.\n\n## Open questions\n\n_To discover together._\n\n## Experiments / POCs\n\n_Record hypothesis, setup, result, and implication here._\n\n## Validation\n\n_Define how each goal and the final desired state will be verified._\n`;
}

function extractGoals(markdown: string): Goal[] {
  const goals: Goal[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^\s*(?:[-*]\s+|\d+[.)]\s+)(?:\[([ xX])\]\s+)?(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = match[2]?.trim();
    if (!text || text.length < 8) continue;
    goals.push({ index: goals.length + 1, text, done: (match[1] ?? "").toLowerCase() === "x" });
  }
  return goals.slice(0, 50);
}

function firstCommand(segment: string): string | undefined {
  const trimmed = segment.trim().replace(/^\w+=\S+\s+/, "");
  return trimmed ? trimmed.split(/\s+/)[0] : undefined;
}

function isReadOnlyBash(command: string): boolean {
  if (/[`$(){}]|\n|>|<|\b(rm|mv|cp|mkdir|touch|chmod|chown|sudo|doas|pkill|kill|curl|wget|tee|install)\b/.test(command)) return false;
  for (const segment of command.split(/&&|\|\||;|\|/g)) {
    const cmd = firstCommand(segment);
    if (!cmd) continue;
    if (!SAFE_COMMANDS.has(cmd)) return false;
    if (cmd === "git" && !/^\s*git\s+(status|log|diff|show|branch|rev-parse|ls-files|grep)\b/.test(segment.trim())) return false;
    if ((cmd === "npm" || cmd === "pnpm" || cmd === "yarn") && !/\b(list|ls|outdated|why|info|view|test|run\s+(test|typecheck|lint|check))\b/.test(segment)) return false;
  }
  return true;
}

function modeInstructions(state: PlanState): string {
  const common = `[LIVING PLAN ACTIVE]\nPlan file: ${state.planPath ?? "not created"}\nDesired state and architecture are the stable trunk. The current focus is HEAD. Questions and POCs are branches. plan_checkpoint records a commit-like checkpoint. Keep the plan useful over the long run; do not force a complete upfront plan.`;
  if (state.mode === "explore") return `${common}\nMode: EXPLORE. Project edits are blocked. Clarify, inspect, research, and update the plan with plan_checkpoint.`;
  if (state.mode === "experiment") return `${common}\nMode: EXPERIMENT. Built-in file edits remain blocked, but bash is available for disposable POCs. Work only in temporary directories, containers, or isolated worktrees; do not mutate the project. Record hypothesis, result, and implication with plan_checkpoint.`;
  if (state.mode === "work") return `${common}\nMode: WORK. Implement only the current meaningful goal. Keep the vision and architecture intact. Record discoveries or deviations with plan_checkpoint and mark validated goals with plan_goal_done.`;
  return "";
}

export default function livingPlanExtension(pi: ExtensionAPI) {
  let state = emptyState();

  function persist(): void {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function updateUI(ctx: ExtensionContext): void {
    if (!state.active || state.mode === "paused") {
      ctx.ui.setStatus("living-plan", state.planPath ? ctx.ui.theme.fg("muted", "📋 paused") : undefined);
      ctx.ui.setWidget("living-plan", undefined);
      return;
    }
    const done = state.goals.filter((goal) => goal.done).length;
    ctx.ui.setStatus("living-plan", ctx.ui.theme.fg(state.mode === "work" ? "accent" : "warning", `📋 ${state.mode} · ${done}/${state.goals.length}`));
    const lines = [state.focus ? `HEAD: ${state.focus}` : `HEAD: ${state.mode}`];
    if (state.goals.length) lines.push(...state.goals.map((goal) => `${goal.done ? "☑" : "☐"} ${goal.index}. ${goal.text}`));
    ctx.ui.setWidget("living-plan", lines);
  }

  function captureTools(): void {
    if (!state.toolsBeforePlan) state.toolsBeforePlan = pi.getActiveTools();
  }

  function applyMode(): void {
    captureTools();
    const baseline = state.toolsBeforePlan ?? pi.getActiveTools();
    if (state.mode === "explore" || state.mode === "experiment") {
      pi.setActiveTools([...new Set([...baseline.filter((name) => !WRITE_TOOLS.has(name)), ...PLAN_TOOLS])]);
    } else {
      pi.setActiveTools([...new Set([...baseline, ...PLAN_TOOLS])]);
    }
  }

  function pause(ctx: ExtensionContext): void {
    if (state.toolsBeforePlan) pi.setActiveTools(state.toolsBeforePlan);
    state.mode = "paused";
    updateUI(ctx);
    persist();
  }

  function close(ctx: ExtensionContext): void {
    if (state.toolsBeforePlan) pi.setActiveTools(state.toolsBeforePlan);
    state = emptyState();
    updateUI(ctx);
    persist();
  }

  function switchMode(mode: Exclude<PlanMode, "paused">, ctx: ExtensionContext): void {
    state.active = true;
    state.mode = mode;
    applyMode();
    updateUI(ctx);
    persist();
  }

  pi.registerTool({
    name: "plan_checkpoint",
    label: "Plan Checkpoint",
    description: "Update the living plan after clarification, a decision, an experiment, a discovery, or a change of focus.",
    parameters: Type.Object({
      markdown: Type.String({ description: "The complete updated Markdown plan; preserve still-valid vision, architecture, decisions, and history" }),
      summary: Type.String({ description: "What changed in this checkpoint" }),
      focus: Type.Optional(Type.String({ description: "The current HEAD: next question, experiment, or goal" })),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      if (!state.active || !state.planPath) return { isError: true, content: [{ type: "text", text: "No living plan is active. Start one with /plan <topic>." }], details: {} };
      writeFileSync(state.planPath, params.markdown.endsWith("\n") ? params.markdown : `${params.markdown}\n`, "utf8");
      state.markdown = params.markdown;
      state.focus = params.focus ?? state.focus;
      state.goals = extractGoals(params.markdown);
      state.checkpoint += 1;
      updateUI(ctx);
      persist();
      return { content: [{ type: "text", text: `Checkpoint ${state.checkpoint} saved to ${state.planPath}: ${params.summary}` }], details: { path: state.planPath, checkpoint: state.checkpoint, goals: state.goals } };
    },
  });

  pi.registerTool({
    name: "plan_goal_done",
    label: "Plan Goal Done",
    description: "Mark a validated living-plan goal complete with evidence. This does not close the plan.",
    parameters: Type.Object({ index: Type.Number(), evidence: Type.String() }),
    async execute(_id, params, _signal, _update, ctx) {
      const goal = state.goals.find((item) => item.index === params.index);
      if (!goal) return { isError: true, content: [{ type: "text", text: `No goal ${params.index}.` }], details: {} };
      goal.done = true;
      goal.evidence = params.evidence;
      updateUI(ctx);
      persist();
      return { content: [{ type: "text", text: `Goal ${params.index} validated: ${params.evidence}` }], details: { goal } };
    },
  });

  pi.registerCommand("plan", {
    description: "Manage a persistent living plan: explore, experiment, work, pause, resume, show, close",
    handler: async (args, ctx) => {
      const input = args.trim();
      const [command, ...rest] = input.split(/\s+/);

      if (command === "pause") {
        pause(ctx);
        ctx.ui.notify("Living plan paused; state is preserved.", "info");
        return;
      }
      if (command === "close" || command === "off") {
        close(ctx);
        ctx.ui.notify("Living plan closed.", "info");
        return;
      }
      if (command === "show" || command === "status") {
        ctx.ui.notify(state.planPath ? `${state.mode}: ${state.planPath}\nHEAD: ${state.focus ?? "unset"}` : "No living plan exists.", "info");
        return;
      }
      if (command === "resume" || command === "explore" || command === "experiment" || command === "work") {
        if (!state.planPath) {
          ctx.ui.notify("No saved plan. Start with /plan <desired state>.", "warning");
          return;
        }
        const mode = command === "resume" ? "explore" : command;
        switchMode(mode, ctx);
        if (rest.length) state.focus = rest.join(" ");
        updateUI(ctx);
        persist();
        ctx.ui.notify(`Living plan resumed in ${mode} mode.`, "info");
        return;
      }

      const topic = input || await ctx.ui.input("Living Plan", "What desired state are we working toward?");
      if (!topic) return;
      const directory = join(ctx.cwd, ".pi", "plans");
      mkdirSync(directory, { recursive: true });
      const path = join(directory, `${today()}-${slugify(topic)}.md`);
      const markdown = initialPlan(topic);
      writeFileSync(path, markdown, "utf8");
      state = {
        active: true,
        mode: "explore",
        topic,
        planPath: path,
        markdown,
        focus: "Clarify the desired state",
        goals: extractGoals(markdown),
        checkpoint: 0,
      };
      applyMode();
      updateUI(ctx);
      persist();
      pi.sendUserMessage(`We opened a persistent living plan for: ${topic}\n\nStart by clarifying the desired state. Do not try to plan everything upfront. Preserve the vision and architecture as the trunk; explore one meaningful uncertainty or goal at a time. Save material decisions and discoveries with plan_checkpoint. Plan file: ${path}`);
    },
  });

  pi.on("tool_call", async (event) => {
    if (!state.active || state.mode === "paused") return;
    if ((state.mode === "explore" || state.mode === "experiment") && WRITE_TOOLS.has(event.toolName)) {
      return { block: true, reason: `${state.mode} mode blocks project edit/write. Use /plan work for an implementation goal.` };
    }
    if (state.mode === "explore" && event.toolName === "bash") {
      const command = String((event.input as any).command ?? "");
      if (!isReadOnlyBash(command)) return { block: true, reason: `Explore mode blocked non-read-only bash. Use /plan experiment for a disposable POC or /plan work for implementation.\nCommand: ${command}` };
    }
  });

  pi.on("before_agent_start", async (event) => {
    if (!state.active || state.mode === "paused") return;
    return { systemPrompt: `${event.systemPrompt}\n\n${modeInstructions(state)}` };
  });

  pi.on("session_start", async (_event, ctx) => {
    const saved = ctx.sessionManager.getEntries()
      .filter((entry: any) => entry.type === "custom" && entry.customType === STATE_ENTRY)
      .pop() as { data?: PlanState } | undefined;
    if (saved?.data) state = { ...emptyState(), ...saved.data };
    if (state.active && state.mode !== "paused") applyMode();
    updateUI(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("living-plan", undefined);
    ctx.ui.setWidget("living-plan", undefined);
  });
}
