import { resolve, sep } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type BranchDocument, type BranchStatus, type BranchType } from "./domain.ts";
import { BranchRevisionConflict, ProjectRevisionConflict, ProjectStore } from "./store.ts";

type RuntimeState = {
  projectId?: string;
  projectRevision?: number;
  branchId?: string;
  branchRevision?: number;
};

const STATE_ENTRY = "project-os-state";
const HELP = `Usage: /project [subcommand] [description]

/project                     Show the current project or resume a branch
/project new <outcome>       Start a long-running project
/project explore <question>  Investigate one uncertainty
/project work <outcome>      Build one verified project increment
/project --help              Show this help

Project files live under .pi/projects/ and remain readable in any editor.`;
const SUBCOMMANDS = [
  ["new", "Start a long-running project"],
  ["explore", "Investigate one uncertainty"],
  ["work", "Build one verified increment"],
  ["--help", "Show command help"],
] as const;

function emptyState(): RuntimeState {
  return {};
}

function isInside(path: string, directory: string): boolean {
  const normalizedPath = resolve(path);
  const normalizedDirectory = resolve(directory);
  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(normalizedDirectory + sep);
}

export default function projectExtension(pi: ExtensionAPI): void {
  let state = emptyState();
  let store = new ProjectStore(process.cwd());
  let commandCwd = process.cwd();

  function useStore(cwd: string): ProjectStore {
    if (store.cwd !== cwd) store = new ProjectStore(cwd);
    commandCwd = cwd;
    return store;
  }

  function persist(): void {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function activateProject(projectId: string): void {
    const project = store.readProject(projectId);
    state = { projectId, projectRevision: project.metadata.revision };
    persist();
  }

  function activateBranch(branch: BranchDocument): void {
    const project = store.readProject(branch.metadata.projectId);
    state = {
      projectId: branch.metadata.projectId,
      projectRevision: project.metadata.revision,
      branchId: branch.metadata.id,
      branchRevision: branch.metadata.revision,
    };
    persist();
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
    activateProject(selected);
    return selected;
  }

  async function startBranch(type: BranchType, title: string, ctx: ExtensionContext): Promise<void> {
    const projectId = await ensureProject(ctx);
    if (!projectId) return;
    const branch = store.createBranch(projectId, type, title);
    activateBranch(branch);
    const verb = type === "explore" ? "Explore" : "Work toward";
    pi.sendUserMessage(`${verb}: ${title}\n\nRead ${store.planPath(projectId)} and ${branch.path}. Keep the branch focused. Record material progress with project_checkpoint. When evidence supports a conclusion or the work is verified, integrate it with project_integrate.`);
  }

  pi.registerCommand("project", {
    description: "Run a long-lived project through exploration and verified work",
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
        const branch = store.createBranch(project.metadata.id, "explore", "Shape project direction");
        activateBranch(branch);
        ctx.ui.notify(`Created ${project.path}`, "info");
        pi.sendUserMessage(`We started a long-running project: ${title}\n\nShape the project direction in ${branch.path}. Clarify the outcome, success evidence, constraints, non-goals, and highest-risk uncertainty. Update the branch with project_checkpoint, then integrate a concise rolling PLAN.md with project_integrate.`);
        return;
      }

      if (command === "explore" || command === "work") {
        const supplied = rest.join(" ");
        const title = supplied || await ctx.ui.input(
          command === "explore" ? "Explore" : "Work",
          command === "explore" ? "What uncertainty should we reduce?" : "What verified outcome should we produce?",
        );
        if (!title) return;
        await startBranch(command, title, ctx);
        return;
      }

      if (command) {
        ctx.ui.notify(`Unknown project command: ${command}. Use /project --help.`, "warning");
        return;
      }

      const projectId = await ensureProject(ctx);
      if (!projectId) return;
      const activeBranches = store.listBranches(projectId).filter((branch) => branch.metadata.status === "active");
      if (!state.branchId && activeBranches.length && ctx.hasUI) {
        const labels = ["Overview", ...activeBranches.map((branch) => `${branch.metadata.id} · ${branch.metadata.type} · ${branch.metadata.title}`)];
        const selection = await ctx.ui.select("Project", labels);
        const branch = activeBranches[labels.indexOf(selection ?? "") - 1];
        if (branch) activateBranch(branch);
      }
      const branch = state.branchId ? store.readBranch(projectId, state.branchId) : undefined;
      const branchLine = branch
        ? `\nActive branch: ${branch.metadata.id} · ${branch.metadata.type} · ${branch.metadata.title}\nBranch file: ${branch.path}`
        : "";
      ctx.ui.notify(`${store.brief(projectId)}\nPLAN: ${store.planPath(projectId)}${branchLine}`, "info");
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
    async execute(_id, params) {
      if (!state.projectId || !state.branchId || state.branchRevision === undefined) {
        throw new Error("No project branch is active. Use /project explore or /project work.");
      }
      try {
        const branch = store.checkpointBranch(state.projectId, state.branchId, state.branchRevision, params.markdown);
        state.branchRevision = branch.metadata.revision;
        persist();
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
    description: "Complete the active branch and revision-safely integrate its result into the project's PLAN.md.",
    promptSnippet: "Integrate a completed exploration or verified work branch into the project",
    promptGuidelines: [
      "Use project_integrate only after an exploration has evidence or a work branch has verification; preserve the project's outcome while updating its rolling Now/Next/Later plan.",
    ],
    parameters: Type.Object({
      branchMarkdown: Type.String({ description: "Complete final branch Markdown without the hidden metadata marker" }),
      planMarkdown: Type.String({ description: "Complete updated PLAN.md based on the latest project revision" }),
      outcome: StringEnum(["adopted", "rejected", "inconclusive", "completed"] as const),
      summary: Type.String({ description: "What the branch established and how the plan changed" }),
      projectStatus: Type.Optional(StringEnum(["active", "completed"] as const, { description: "Mark completed only when project success evidence is satisfied" })),
      decision: Type.Optional(Type.Object({
        title: Type.String({ description: "Short durable decision title" }),
        markdown: Type.String({ description: "Context, decision, and consequences" }),
      })),
    }),
    async execute(_id, params) {
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
          planMarkdown: params.planMarkdown,
          status: params.outcome,
          projectStatus: params.projectStatus,
          decision: params.decision,
        });
        state = {
          projectId: state.projectId,
          projectRevision: result.project.metadata.revision,
        };
        persist();
        const decision = result.decisionPath ? ` Decision: ${result.decisionPath}.` : "";
        return {
          content: [{ type: "text", text: `Integrated ${result.branch.metadata.id} into revision ${result.project.metadata.revision}: ${params.summary}.${decision}` }],
          details: {
            project: result.project.metadata,
            branch: result.branch.metadata,
            planPath: store.planPath(result.project.metadata.id),
            decisionPath: result.decisionPath,
          },
        };
      } catch (error) {
        if (error instanceof ProjectRevisionConflict) {
          state.projectRevision = error.metadata.revision;
          persist();
          throw new Error(`${error.message}\n\nLatest PLAN.md:\n${error.plan}`);
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

  pi.on("before_agent_start", async (event) => {
    if (!state.projectId) return;
    let project;
    try {
      project = store.readProject(state.projectId);
    } catch {
      return;
    }
    if (!state.branchId) {
      return {
        systemPrompt: `${event.systemPrompt}\n\n[PROJECT ACTIVE]\nProject: ${project.metadata.title}\nPLAN: ${store.planPath(project.metadata.id)}\nTreat PLAN.md as the concise project trunk. Start an explore or work branch before changing project direction.`,
      };
    }
    const branch = store.readBranch(state.projectId, state.branchId);
    const explorationDirectory = store.explorationPath(branch.metadata.id);
    const instructions = branch.metadata.type === "explore"
      ? `Mode: EXPLORE. Reduce one uncertainty through evidence. Do not mutate the project checkout. Use read-only research or disposable files under ${explorationDirectory}, /tmp, containers, or isolated worktrees. An exploration may be adopted, rejected, or remain inconclusive.`
      : "Mode: WORK. Produce one bounded project increment and verify its completion evidence. Record discoveries that materially change the project.";
    return {
      systemPrompt: `${event.systemPrompt}\n\n[PROJECT BRANCH ACTIVE]\nProject: ${project.metadata.title}\nPLAN: ${store.planPath(project.metadata.id)}\nBranch: ${branch.path}\n${instructions}\nUse project_checkpoint for material branch updates. Use project_integrate only when evidence supports integration into the latest PLAN.md.`,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!state.projectId || !state.branchId || (event.toolName !== "edit" && event.toolName !== "write")) return;
    const branch = store.readBranch(state.projectId, state.branchId);
    if (branch.metadata.type !== "explore") return;
    const rawPath = String((event.input as { path?: unknown }).path ?? "");
    const target = resolve(ctx.cwd, rawPath.replace(/^@/, ""));
    if (isInside(target, ctx.cwd) && !isInside(target, store.explorationPath(branch.metadata.id))) {
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
  });
}
