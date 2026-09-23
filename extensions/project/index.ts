import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ProjectStore } from "./store.ts";
import type { ProjectArea } from "./domain.ts";

type RuntimeState = {
  projectId?: string;
  activeFile?: string;
  activeArea?: ProjectArea;
};

const STATE_ENTRY = "project-simple-state";
const STATUS_ID = "project-harness-status";
const HELP = `Usage: /project [subcommand]\n\n/project new <title>       Create a project workspace\n/project open [project]    Open an existing project\n/project status            Show the project document and folders\n/project explore <topic>   Create an exploration note\n/project work <outcome>    Create an implementation record\n/project exit              Clear the active project`;
const SUBCOMMANDS = [
  ["new", "Create a project workspace"],
  ["open", "Open an existing project"],
  ["status", "Show project paths and status"],
  ["explore", "Create an exploration note"],
  ["work", "Create an implementation record"],
  ["exit", "Clear the active project"],
  ["--help", "Show command help"],
] as const;

function emptyState(): RuntimeState {
  return {};
}

export default function projectExtension(pi: ExtensionAPI): void {
  let state = emptyState();
  let store = new ProjectStore(process.cwd());

  function useStore(cwd: string): void {
    if (store.cwd !== cwd) store = new ProjectStore(cwd);
  }

  function persist(): void {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function clearDisplay(ctx: ExtensionContext): void {
    ctx.ui.setStatus(STATUS_ID, undefined);
  }

  function updateDisplay(ctx: ExtensionContext): void {
    if (!state.projectId) return clearDisplay(ctx);
    try {
      const project = store.readProject(state.projectId);
      const status = `Project ${project.title}: ${store.status(project.id)}`;
      ctx.ui.setStatus(STATUS_ID, ctx.ui.theme?.fg("muted", status) ?? status);
    } catch {
      state = emptyState();
      clearDisplay(ctx);
    }
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
    const projects = store.listProjects();
    if (!projects.length) {
      ctx.ui.notify("No project is open. Start with /project new <title>.", "warning");
      return undefined;
    }
    const labels = projects.map((item) => `${item.title} (${item.id})`);
    const selected = projects.length === 1 ? labels[0] : ctx.hasUI ? await ctx.ui.select("Open project", labels) : undefined;
    const project = projects[labels.indexOf(selected ?? "")];
    if (!project) {
      ctx.ui.notify("Choose a project in interactive mode.", "warning");
      return undefined;
    }
    state = { projectId: project.id };
    persist();
    updateDisplay(ctx);
    return project.id;
  }

  function projectStatus(id: string): string {
    const project = store.readProject(id);
    return [
      `Project: ${project.title}`,
      `Current status: ${store.status(id)}`,
      `Project document: ${project.path}`,
      `Explorations: ${store.areaPath(id, "explore")}`,
      `Work records: ${store.areaPath(id, "work")}`,
    ].join("\n");
  }

  function kickoff(projectId: string, area: ProjectArea, file: string): string {
    const project = store.readProject(projectId);
    const kind = area === "explore" ? "exploration" : "implementation";
    return `Project active: ${project.title}\n\nRead ${project.path} and ${file}. This is a ${kind} record. Update ${file} with the useful detail and evidence as you proceed. Keep ${project.path} limited to the vision, direction, and one-sentence current status. Use normal file tools; there are no project checkpoint or integration tools.`;
  }

  async function startRecord(ctx: ExtensionContext, area: ProjectArea, title: string): Promise<void> {
    const projectId = await ensureProject(ctx);
    if (!projectId) return;
    const file = store.createRecord(projectId, area, title);
    state = { projectId, activeArea: area, activeFile: file };
    persist();
    updateDisplay(ctx);
    ctx.ui.notify(`Created ${file}`, "info");
    pi.sendUserMessage(kickoff(projectId, area, file));
  }

  pi.registerCommand("project", {
    description: "Keep a simple project document, explorations, and work records",
    getArgumentCompletions: (prefix) => {
      const query = prefix.trim().toLowerCase();
      if (query.includes(" ")) return null;
      const matches = SUBCOMMANDS
        .filter(([name]) => name.startsWith(query))
        .map(([value, description]) => ({ value, label: value, description }));
      return matches.length ? matches : null;
    },
    handler: async (args, ctx) => {
      useStore(ctx.cwd);
      const [command = "", ...rest] = args.trim().split(/\s+/);
      const value = rest.join(" ");

      if (["--help", "-h", "help"].includes(command)) return void ctx.ui.notify(HELP, "info");
      if (command === "new") {
        const title = value || await ctx.ui.input("New project", "What are we pursuing?");
        if (!title) return;
        const project = store.createProject(title);
        state = { projectId: project.id };
        persist();
        updateDisplay(ctx);
        ctx.ui.notify(`Created ${project.path}`, "info");
        pi.sendUserMessage(`Project active: ${project.title}\n\nRead and shape ${project.path}. Keep it to vision, direction, and a one-sentence current status. Use /project explore for research notes or /project work for implementation records.`);
        return;
      }
      if (command === "open") {
        const projects = store.listProjects();
        const project = value
          ? projects.find((item) => item.id === value || item.title.toLowerCase() === value.toLowerCase())
          : projects.length === 1
            ? projects[0]
            : undefined;
        if (project) {
          state = { projectId: project.id };
          persist();
          updateDisplay(ctx);
          ctx.ui.notify(`Opened ${project.path}`, "info");
        } else if (!value && projects.length > 1 && ctx.hasUI) {
          const labels = projects.map((item) => `${item.title} (${item.id})`);
          const selected = await ctx.ui.select("Open project", labels);
          const picked = projects[labels.indexOf(selected ?? "")];
          if (picked) {
            state = { projectId: picked.id };
            persist();
            updateDisplay(ctx);
            ctx.ui.notify(`Opened ${picked.path}`, "info");
          }
        } else ctx.ui.notify("Project not found. Use /project new <title> or /project open <id>.", "warning");
        return;
      }
      if (command === "explore" || command === "work") {
        const title = value || await ctx.ui.input(command === "explore" ? "Explore" : "Work", command === "explore" ? "What should we investigate?" : "What should we implement?");
        if (title) await startRecord(ctx, command, title);
        return;
      }
      if (command === "status" || !command) {
        const projectId = await ensureProject(ctx);
        if (projectId) ctx.ui.notify(projectStatus(projectId), "info");
        return;
      }
      if (command === "exit") {
        state = emptyState();
        persist();
        clearDisplay(ctx);
        ctx.ui.notify("Project context cleared.", "info");
        return;
      }
      ctx.ui.notify(`Unknown project command: ${command}. Use /project --help.`, "warning");
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.projectId) return;
    useStore(ctx.cwd);
    try {
      const project = store.readProject(state.projectId);
      const record = state.activeFile ? `\nActive record: ${state.activeFile}` : "";
      return {
        systemPrompt: `${event.systemPrompt}\n\n[PROJECT ACTIVE]\nProject document: ${project.path}${record}\nKeep the project document limited to its vision, direction, and one-sentence current status. Store detailed research in its explore folder and implementation plans/results in its work folder.`,
      };
    } catch {
      state = emptyState();
      clearDisplay(ctx);
      return;
    }
  });

  pi.on("agent_settled", async (_event, ctx) => updateDisplay(ctx));
  pi.on("session_start", async (_event, ctx) => {
    useStore(ctx.cwd);
    const saved = ctx.sessionManager.getEntries()
      .filter((entry: any) => entry.type === "custom" && entry.customType === STATE_ENTRY)
      .pop() as { data?: RuntimeState } | undefined;
    state = saved?.data ? { ...saved.data } : emptyState();
    updateDisplay(ctx);
  });
  pi.on("session_shutdown", async (_event, ctx) => clearDisplay(ctx));
}
