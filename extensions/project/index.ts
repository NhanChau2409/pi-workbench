import { resolve, sep } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  dashboardLines,
  projectDashboard,
  section,
  snapshotField,
  type BranchDocument,
  type BranchStatus,
  type BranchType,
  type OperationalPhase,
} from "./domain.ts";
import { BranchRevisionConflict, ProjectRevisionConflict, ProjectStore } from "./store.ts";

type RuntimeState = {
  projectId?: string;
  projectRevision?: number;
  branchId?: string;
  branchRevision?: number;
};

type ActivityState = {
  phase: OperationalPhase;
  action: string;
};

const STATE_ENTRY = "project-os-state";
const STATUS_ID = "project-harness-status";
const WIDGET_ID = "project-harness-widget";
const HELP = `Usage: /project [subcommand] [description]

/project                              Open the dashboard and branch selector
/project status                       Show complete current project context
/project overview                     Keep project context, leave branch context
/project switch                       Select a branch in a fresh Pi session
/project exit                         Clear project context and status display
/project new <outcome>                Start a long-running project
/project explore <question>           Explore uncertainty for the current milestone
/project work <outcome>               Build one verified increment
/project work --from EXP-NNN <outcome> Start work from an adopted exploration
/project --help                       Show this help`;
const SUBCOMMANDS = [
  ["status", "Show complete project context"],
  ["overview", "Leave branch context"],
  ["switch", "Switch branch in a fresh session"],
  ["exit", "Clear project context"],
  ["new", "Start a long-running project"],
  ["explore", "Investigate one uncertainty"],
  ["work", "Build one verified increment"],
  ["--help", "Show command help"],
] as const;

function emptyState(): RuntimeState {
  return {};
}

function waiting(): ActivityState {
  return { phase: "WAITING", action: "Idle" };
}

function isInside(path: string, directory: string): boolean {
  const normalizedPath = resolve(path);
  const normalizedDirectory = resolve(directory);
  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(normalizedDirectory + sep);
}

function operationForTool(toolName: string, args: unknown): ActivityState {
  const input = args as { command?: unknown; path?: unknown };
  const command = typeof input.command === "string" ? input.command : "";
  if (toolName === "project_integrate") return { phase: "VERIFYING", action: "Integrating verified evidence" };
  if (toolName === "project_checkpoint") return { phase: "VERIFYING", action: "Recording evidence" };
  if (/\b(test|typecheck|lint|check|verify|validate|build|pack|smoke)\b/i.test(command)) {
    return { phase: "VERIFYING", action: "Running verification" };
  }
  if (/\b(deploy|release|publish|install)\b/i.test(command)) {
    return { phase: "VERIFYING", action: "Deploying or releasing" };
  }
  if (["read", "grep", "find", "ls", "web_search", "web_fetch"].includes(toolName)) {
    return { phase: "EXPLORING", action: "Reading and inspecting" };
  }
  if (["edit", "write", "bash", "powershell"].includes(toolName)) {
    return { phase: "IMPLEMENTING", action: "Changing the implementation" };
  }
  return { phase: "IMPLEMENTING", action: `Running ${toolName}` };
}

function recommendedWorkCommand(plan: string, branch: BranchDocument): string {
  const escapedId = branch.metadata.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const planned = new RegExp(`/project work --from ${escapedId} [^\\n\u0060]+`).exec(plan)?.[0]?.trim();
  return planned ?? `/project work --from ${branch.metadata.id} Implement ${branch.metadata.title}`;
}

function kickoffMessage(store: ProjectStore, branch: BranchDocument): string {
  const paths = [store.visionPath(branch.metadata.projectId), store.planPath(branch.metadata.projectId)];
  if (branch.metadata.fromBranchId) paths.push(store.readBranch(branch.metadata.projectId, branch.metadata.fromBranchId).path);
  paths.push(...store.decisionPaths(branch.metadata.projectId, branch.metadata.sourceDecisionIds ?? []));
  paths.push(branch.path);
  const verb = branch.metadata.type === "explore" ? "Explore" : "Work toward";
  return `${verb}: ${branch.metadata.title}\n\nRead ${paths.join(", ")}. Preserve the PROJECT.md vision while keeping the branch focused. Treat POCs as fast feedback loops for reducing uncertainty. Record material progress with project_checkpoint. When evidence supports a conclusion or the work is verified, integrate it with project_integrate.`;
}

export default function projectExtension(pi: ExtensionAPI): void {
  let state = emptyState();
  let activity = waiting();
  let store = new ProjectStore(process.cwd());

  function useStore(cwd: string): ProjectStore {
    if (store.cwd !== cwd) store = new ProjectStore(cwd);
    return store;
  }

  function persist(): void {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function clearDisplay(ctx: ExtensionContext): void {
    ctx.ui.setStatus(STATUS_ID, undefined);
    ctx.ui.setWidget(WIDGET_ID, undefined);
  }

  function activeBranch(): BranchDocument | undefined {
    if (!state.projectId || !state.branchId) return undefined;
    try {
      return store.readBranch(state.projectId, state.branchId);
    } catch {
      return undefined;
    }
  }

  function updateDisplay(ctx: ExtensionContext): void {
    if (!state.projectId) {
      clearDisplay(ctx);
      return;
    }
    try {
      const project = store.readProject(state.projectId);
      const dashboard = projectDashboard(
        project.metadata,
        project.projectMarkdown,
        project.plan,
        activeBranch(),
        activity.phase,
        activity.action,
      );
      const branch = dashboard.activeBranch ? ` · ${dashboard.activeBranch}` : "";
      ctx.ui.setStatus(STATUS_ID, `${dashboard.phase}${branch} · ${dashboard.observableAction}`);
      ctx.ui.setWidget(WIDGET_ID, dashboardLines(dashboard));
    } catch {
      state = emptyState();
      clearDisplay(ctx);
    }
  }

  function setActivity(ctx: ExtensionContext, next: ActivityState): void {
    activity = next;
    updateDisplay(ctx);
  }

  function activateProject(projectId: string, ctx?: ExtensionContext): void {
    const project = store.readProject(projectId);
    state = { projectId, projectRevision: project.metadata.revision };
    persist();
    if (ctx) updateDisplay(ctx);
  }

  function activateBranch(branch: BranchDocument, ctx?: ExtensionContext): void {
    const project = store.readProject(branch.metadata.projectId);
    state = {
      projectId: branch.metadata.projectId,
      projectRevision: project.metadata.revision,
      branchId: branch.metadata.id,
      branchRevision: branch.metadata.revision,
    };
    persist();
    if (ctx) updateDisplay(ctx);
  }

  async function ensureProject(ctx: ExtensionContext): Promise<string | undefined> {
    useStore(ctx.cwd);
    if (state.projectId) {
      try {
        store.readProject(state.projectId);
        return state.projectId;
      } catch {
        state = emptyState();
      }
    }

    const projects = store.listProjects().filter((project) => project.metadata.status === "active");
    if (projects.length === 0) {
      ctx.ui.notify("No active project. Start with /project new <outcome>.", "warning");
      return undefined;
    }
    let selected = projects.length === 1 ? projects[0]?.metadata.id : undefined;
    if (!selected && ctx.hasUI) {
      const labels = projects.map((project) => `${project.metadata.title} (${project.metadata.id})`);
      const label = await ctx.ui.select("Select project", labels);
      selected = projects[labels.indexOf(label ?? "")]?.metadata.id;
    }
    if (!selected) {
      ctx.ui.notify("Select a project in interactive mode or start a new one.", "warning");
      return undefined;
    }
    activateProject(selected, ctx);
    return selected;
  }

  function branchContext(projectId: string): { relatedGoal: string; relatedMilestone: string } {
    const project = store.readProject(projectId);
    return {
      relatedGoal: section(project.projectMarkdown, "Vision"),
      relatedMilestone: snapshotField(project.plan, "Now") ?? section(project.plan, "Outcome"),
    };
  }

  async function startBranch(
    type: BranchType,
    title: string,
    ctx: ExtensionContext,
    fromBranchId?: string,
  ): Promise<void> {
    const projectId = await ensureProject(ctx);
    if (!projectId) return;
    let source: BranchDocument | undefined;
    if (fromBranchId) {
      if (type !== "work") throw new Error("Only work branches can use --from.");
      source = store.readBranch(projectId, fromBranchId);
      if (source.metadata.type !== "explore" || source.metadata.status !== "adopted") {
        throw new Error(`${fromBranchId} must be an adopted exploration before work can start from it.`);
      }
    }
    const branch = store.createBranch(projectId, type, title, {
      ...branchContext(projectId),
      ...(fromBranchId ? {
        fromBranchId,
        sourceBranchIds: [fromBranchId],
        sourceDecisionIds: source?.metadata.sourceDecisionIds,
      } : {}),
    });
    activateBranch(branch, ctx);
    pi.sendUserMessage(kickoffMessage(store, branch));
  }

  function completeStatus(projectId: string): string {
    const project = store.readProject(projectId);
    const branch = activeBranch();
    const dashboard = projectDashboard(
      project.metadata,
      project.projectMarkdown,
      project.plan,
      branch,
      activity.phase,
      activity.action,
    );
    const metadata = branch
      ? [
          `Base revision: ${branch.metadata.baseRevision}`,
          `Related goal: ${branch.metadata.relatedGoal ?? "Not recorded"}`,
          `Related milestone: ${branch.metadata.relatedMilestone ?? "Not recorded"}`,
          `Source lineage: ${branch.metadata.sourceBranchIds?.join(", ") ?? branch.metadata.fromBranchId ?? "None"}`,
          `Branch file: ${branch.path}`,
        ]
      : ["Branch context: overview"];
    return [
      ...dashboardLines(dashboard),
      `Project revision: ${project.metadata.revision}`,
      ...metadata,
      `PROJECT: ${store.visionPath(projectId)}`,
      `PLAN: ${store.planPath(projectId)}`,
    ].join("\n");
  }

  async function openBranchInFreshSession(branch: BranchDocument, ctx: ExtensionCommandContext): Promise<void> {
    const project = store.readProject(branch.metadata.projectId);
    const nextState: RuntimeState = {
      projectId: branch.metadata.projectId,
      projectRevision: project.metadata.revision,
      branchId: branch.metadata.id,
      branchRevision: branch.metadata.revision,
    };
    const kickoff = kickoffMessage(store, branch);
    await ctx.waitForIdle();
    await ctx.newSession({
      parentSession: ctx.sessionManager.getSessionFile(),
      setup: async (sessionManager) => {
        sessionManager.appendCustomEntry(STATE_ENTRY, nextState);
      },
      withSession: async (replacement) => {
        await replacement.sendUserMessage(kickoff);
      },
    });
  }

  async function switchBranch(ctx: ExtensionCommandContext): Promise<void> {
    const projectId = await ensureProject(ctx);
    if (!projectId) return;
    const branches = store.listBranches(projectId).filter((branch) => branch.metadata.status === "active");
    if (!branches.length) {
      ctx.ui.notify("No active branches to switch to.", "warning");
      return;
    }
    const labels = branches.map((branch) => `${branch.metadata.id} · ${branch.metadata.type} · ${branch.metadata.title}`);
    const selection = ctx.hasUI ? await ctx.ui.select("Switch project branch", labels) : undefined;
    const branch = branches[labels.indexOf(selection ?? "")];
    if (branch) await openBranchInFreshSession(branch, ctx);
  }

  pi.registerCommand("project", {
    description: "Run a visible long-lived project through exploration and verified work",
    getArgumentCompletions: (prefix) => {
      const query = prefix.trim().toLowerCase();
      if (query.includes(" ")) return null;
      const commands = SUBCOMMANDS
        .filter(([name]) => name.startsWith(query))
        .map(([name, description]) => ({ value: name, label: name, description }));
      return commands.length ? commands : null;
    },
    handler: async (args, ctx) => {
      useStore(ctx.cwd);
      const input = args.trim();
      const [command = "", ...rest] = input.split(/\s+/);

      if (command === "--help" || command === "-h" || command === "help") {
        ctx.ui.notify(HELP, "info");
        return;
      }

      if (command === "new") {
        const supplied = rest.join(" ");
        const title = supplied || await ctx.ui.input("New project", "What outcome are we pursuing?");
        if (!title) return;
        const project = store.createProject(title);
        const branch = store.createBranch(project.metadata.id, "explore", "Shape project direction", branchContext(project.metadata.id));
        activateBranch(branch, ctx);
        ctx.ui.notify(`Created ${project.path}`, "info");
        pi.sendUserMessage(`We started a long-running project: ${title}\n\nShape the durable vision in ${store.visionPath(project.metadata.id)} and the rolling direction in ${branch.path}. Clarify the long-term vision, intended experience, milestones, current outcome, success evidence, constraints, non-goals, and highest-risk uncertainty. Treat POCs as fast feedback loops, not as definitions of the final vision. Update the branch with project_checkpoint, then integrate PROJECT.md and a concise rolling PLAN.md with project_integrate.`);
        return;
      }

      if (command === "explore") {
        const supplied = rest.join(" ");
        const title = supplied || await ctx.ui.input("Explore", "What uncertainty should we reduce?");
        if (!title) return;
        await startBranch("explore", title, ctx);
        return;
      }

      if (command === "work") {
        let workArgs = [...rest];
        let fromBranchId: string | undefined;
        if (workArgs[0] === "--from") {
          fromBranchId = workArgs[1];
          workArgs = workArgs.slice(2);
          if (!fromBranchId || !/^EXP-\d+$/.test(fromBranchId)) {
            ctx.ui.notify("Usage: /project work --from EXP-NNN <outcome>", "warning");
            return;
          }
        }
        const supplied = workArgs.join(" ");
        const title = supplied || await ctx.ui.input("Work", "What verified outcome should we produce?");
        if (!title) return;
        try {
          await startBranch("work", title, ctx, fromBranchId);
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
        }
        return;
      }

      if (command === "status") {
        const projectId = await ensureProject(ctx);
        if (projectId) ctx.ui.notify(completeStatus(projectId), "info");
        return;
      }

      if (command === "overview") {
        const projectId = await ensureProject(ctx);
        if (!projectId) return;
        activateProject(projectId, ctx);
        ctx.ui.notify("Project overview active; branch context cleared.", "info");
        return;
      }

      if (command === "switch") {
        await switchBranch(ctx);
        return;
      }

      if (command === "exit") {
        state = emptyState();
        activity = waiting();
        persist();
        clearDisplay(ctx);
        ctx.ui.notify("Project context cleared.", "info");
        return;
      }

      if (command) {
        ctx.ui.notify(`Unknown project command: ${command}. Use /project --help.`, "warning");
        return;
      }

      const projectId = await ensureProject(ctx);
      if (!projectId) return;
      const activeBranches = store.listBranches(projectId).filter((branch) => branch.metadata.status === "active");
      const labels = ["Show status", "Overview", "Switch branch", ...activeBranches.map((branch) => `${branch.metadata.id} · ${branch.metadata.type} · ${branch.metadata.title}`)];
      const selection = ctx.hasUI ? await ctx.ui.select("Project dashboard", labels) : undefined;
      if (selection === "Overview") activateProject(projectId, ctx);
      else if (selection === "Switch branch") await switchBranch(ctx);
      else {
        const branch = activeBranches[labels.indexOf(selection ?? "") - 3];
        if (branch) {
          await openBranchInFreshSession(branch, ctx);
          return;
        }
      }
      if (selection !== "Switch branch") ctx.ui.notify(completeStatus(projectId), "info");
    },
  });

  pi.registerTool({
    name: "project_checkpoint",
    label: "Project Checkpoint",
    description: "Save the complete Markdown body of the active project branch after material learning or progress.",
    promptSnippet: "Save material progress to the active project branch",
    promptGuidelines: [
      "Use project_checkpoint only for material evidence, decisions, progress, or changes of focus in the active project branch.",
    ],
    parameters: Type.Object({
      markdown: Type.String({ description: "Complete branch Markdown without the hidden metadata marker" }),
      summary: Type.String({ description: "Concise description of what changed" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!state.projectId || !state.branchId || state.branchRevision === undefined) {
        throw new Error("No project branch is active. Use /project explore or /project work.");
      }
      try {
        const branch = store.checkpointBranch(state.projectId, state.branchId, state.branchRevision, params.markdown);
        state.branchRevision = branch.metadata.revision;
        persist();
        updateDisplay(ctx);
        return {
          content: [{ type: "text", text: `Checkpoint ${branch.metadata.revision} saved to ${branch.path}: ${params.summary}` }],
          details: { branch: branch.metadata, path: branch.path },
        };
      } catch (error) {
        if (error instanceof BranchRevisionConflict) {
          state.branchRevision = error.branch.metadata.revision;
          persist();
          throw new Error(`${error.message}\n\nLatest branch content:\n${error.branch.markdown}`);
        }
        throw error;
      }
    },
  });

  pi.registerTool({
    name: "project_integrate",
    label: "Project Integrate",
    description: "Complete the active branch and revision-safely integrate its result into the project's PROJECT.md and PLAN.md.",
    promptSnippet: "Integrate a completed exploration or verified work branch into the project",
    promptGuidelines: [
      "Use project_integrate only after an exploration has evidence or a work branch has verification; preserve the durable PROJECT.md vision while updating the rolling PLAN.md Now/Next/Later plan.",
    ],
    parameters: Type.Object({
      branchMarkdown: Type.String({ description: "Complete final branch Markdown without the hidden metadata marker" }),
      projectMarkdown: Type.String({ description: "Complete durable PROJECT.md vision based on the latest project revision" }),
      planMarkdown: Type.String({ description: "Complete updated rolling PLAN.md based on the latest project revision" }),
      outcome: StringEnum(["adopted", "rejected", "inconclusive", "completed"] as const),
      summary: Type.String({ description: "What the branch established and how the plan changed" }),
      projectStatus: Type.Optional(StringEnum(["active", "completed"] as const, { description: "Mark completed only when project success evidence is satisfied" })),
      decision: Type.Optional(Type.Object({
        title: Type.String({ description: "Short durable decision title" }),
        markdown: Type.String({ description: "Context, decision, and consequences" }),
      })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!state.projectId || !state.branchId || state.branchRevision === undefined || state.projectRevision === undefined) {
        throw new Error("No project branch is active.");
      }
      const branch = store.readBranch(state.projectId, state.branchId);
      const allowed: BranchStatus[] = branch.metadata.type === "explore"
        ? ["adopted", "rejected", "inconclusive"]
        : ["completed"];
      if (!allowed.includes(params.outcome)) {
        throw new Error(`${branch.metadata.type} branch ${branch.metadata.id} cannot finish as ${params.outcome}.`);
      }

      try {
        const result = store.integrateBranch(state.projectId, state.branchId, {
          expectedProjectRevision: state.projectRevision,
          expectedBranchRevision: state.branchRevision,
          branchMarkdown: params.branchMarkdown,
          projectMarkdown: params.projectMarkdown,
          planMarkdown: params.planMarkdown,
          status: params.outcome,
          projectStatus: params.projectStatus,
          decision: params.decision,
        });
        state = { projectId: state.projectId, projectRevision: result.project.metadata.revision };
        persist();
        activity = waiting();
        updateDisplay(ctx);
        const decision = result.decisionPath ? ` Decision: ${result.decisionPath}.` : "";
        const recommendation = branch.metadata.type === "explore" && params.outcome === "adopted"
          ? `\nRecommended next command: ${recommendedWorkCommand(params.planMarkdown, branch)}`
          : "";
        return {
          content: [{ type: "text", text: `Integrated ${result.branch.metadata.id} into revision ${result.project.metadata.revision}: ${params.summary}.${decision}${recommendation}` }],
          details: {
            project: result.project.metadata,
            branch: result.branch.metadata,
            planPath: store.planPath(result.project.metadata.id),
            decisionPath: result.decisionPath,
            recommendedCommand: recommendation.trim().replace(/^Recommended next command: /, "") || undefined,
          },
        };
      } catch (error) {
        if (error instanceof ProjectRevisionConflict) {
          state.projectRevision = error.metadata.revision;
          persist();
          throw new Error(`${error.message}\n\nLatest PROJECT.md:\n${error.projectMarkdown}\n\nLatest PLAN.md:\n${error.plan}`);
        }
        if (error instanceof BranchRevisionConflict) {
          state.branchRevision = error.branch.metadata.revision;
          persist();
          throw new Error(`${error.message}\n\nLatest branch content:\n${error.branch.markdown}`);
        }
        throw error;
      }
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.projectId) return;
    let project;
    try {
      project = store.readProject(state.projectId);
    } catch {
      return;
    }
    const branch = activeBranch();
    setActivity(ctx, branch
      ? { phase: branch.metadata.type === "explore" ? "EXPLORING" : "IMPLEMENTING", action: "Planning the next observable operation" }
      : { phase: "SHAPING", action: "Shaping project direction" });
    if (!branch) {
      return {
        systemPrompt: `${event.systemPrompt}\n\n[PROJECT ACTIVE]\nProject: ${project.metadata.title}\nPROJECT: ${store.visionPath(project.metadata.id)}\nPLAN: ${store.planPath(project.metadata.id)}\nTreat PROJECT.md as the durable vision and PLAN.md as the concise rolling execution trunk. Preserve the vision across fast-feedback POCs. Start an explore or work branch before changing project direction. Always end user-facing project responses with the concrete next step.`,
      };
    }
    const explorationDirectory = store.explorationPath(branch.metadata.id);
    const source = branch.metadata.fromBranchId ? `\nSource exploration: ${store.readBranch(state.projectId, branch.metadata.fromBranchId).path}` : "";
    const instructions = branch.metadata.type === "explore"
      ? `Mode: EXPLORE. Reduce one uncertainty through evidence. Do not mutate the project checkout. Use read-only research or disposable files under ${explorationDirectory}, /tmp, containers, or isolated worktrees. An exploration may be adopted, rejected, or remain inconclusive.`
      : "Mode: WORK. Produce one bounded project increment and verify its completion evidence. Record discoveries that materially change the project.";
    return {
      systemPrompt: `${event.systemPrompt}\n\n[PROJECT BRANCH ACTIVE]\nProject: ${project.metadata.title}\nPROJECT: ${store.visionPath(project.metadata.id)}\nPLAN: ${store.planPath(project.metadata.id)}\nBranch: ${branch.path}${source}\n${instructions}\nTreat POCs as fast feedback loops that reduce uncertainty without shrinking the PROJECT.md vision. Use project_checkpoint for material branch updates. Use project_integrate only when evidence supports revision-safe integration into PROJECT.md and PLAN.md. Always end user-facing project responses with the concrete next step.`,
    };
  });

  pi.on("tool_execution_start", async (event, ctx) => {
    if (state.projectId) setActivity(ctx, operationForTool(event.toolName, event.args));
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (!state.projectId) return;
    if (event.isError) setActivity(ctx, { phase: "BLOCKED", action: `${event.toolName} failed` });
  });

  pi.on("ui_prompt_start", async (_event, ctx) => {
    if (state.projectId) setActivity(ctx, { phase: "WAITING", action: "Waiting for user input" });
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (state.projectId) setActivity(ctx, waiting());
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!state.projectId || !state.branchId || (event.toolName !== "edit" && event.toolName !== "write")) return;
    const branch = store.readBranch(state.projectId, state.branchId);
    if (branch.metadata.type !== "explore") return;
    const rawPath = String((event.input as { path?: unknown }).path ?? "");
    const target = resolve(ctx.cwd, rawPath.replace(/^@/, ""));
    if (isInside(target, ctx.cwd) && !isInside(target, store.explorationPath(branch.metadata.id))) {
      setActivity(ctx, { phase: "BLOCKED", action: "Protected checkout write blocked" });
      return {
        block: true,
        reason: `Explore branch ${branch.metadata.id} keeps project files read-only. Use ${store.explorationPath(branch.metadata.id)}, /tmp, a container, or an isolated worktree for disposable POCs.`,
      };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    useStore(ctx.cwd);
    const saved = ctx.sessionManager.getEntries()
      .filter((entry: any) => entry.type === "custom" && entry.customType === STATE_ENTRY)
      .pop() as { data?: RuntimeState } | undefined;
    state = saved?.data ? { ...saved.data } : emptyState();
    activity = waiting();
    if (state.projectId) {
      try {
        const project = store.readProject(state.projectId);
        state.projectRevision = project.metadata.revision;
        if (state.branchId) {
          const branch = store.readBranch(state.projectId, state.branchId);
          if (branch.metadata.status === "active") state.branchRevision = branch.metadata.revision;
          else state = { projectId: state.projectId, projectRevision: project.metadata.revision };
        }
      } catch {
        state = emptyState();
      }
    }
    updateDisplay(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearDisplay(ctx);
  });
}
