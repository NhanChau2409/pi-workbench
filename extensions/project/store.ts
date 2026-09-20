import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  branchTemplate,
  parseBranch,
  projectBrief,
  projectPlanTemplate,
  projectVisionTemplate,
  serializeBranch,
  slugify,
  validatePlan,
  validateProject,
  type BranchDocument,
  type BranchMetadata,
  type BranchStatus,
  type BranchType,
  type ProjectMetadata,
} from "./domain.ts";

export class BranchRevisionConflict extends Error {
  constructor(public readonly branch: BranchDocument) {
    super(`Branch ${branch.metadata.id} changed to revision ${branch.metadata.revision}; reload it before retrying.`);
  }
}

export class ProjectRevisionConflict extends Error {
  constructor(
    public readonly metadata: ProjectMetadata,
    public readonly projectMarkdown: string,
    public readonly plan: string,
  ) {
    super(`Project changed to revision ${metadata.revision}; reconcile the latest PROJECT.md and PLAN.md before retrying.`);
  }
}

type ProjectRecord = {
  metadata: ProjectMetadata;
  projectMarkdown: string;
  plan: string;
  path: string;
};

type IntegrationInput = {
  expectedProjectRevision: number;
  expectedBranchRevision: number;
  branchMarkdown: string;
  projectMarkdown: string;
  planMarkdown: string;
  status: Exclude<BranchStatus, "active">;
  projectStatus?: "active" | "completed";
  decision?: { title: string; markdown: string };
};

export type CreateBranchOptions = {
  relatedGoal?: string;
  relatedMilestone?: string;
  fromBranchId?: string;
  sourceBranchIds?: string[];
  sourceDecisionIds?: string[];
};

const LOCK_STALE_MS = 5 * 60 * 1000;

function now(): string {
  return new Date().toISOString();
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizedMarkdown(markdown: string): string {
  return markdown.trimEnd() + "\n";
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, "utf8");
  renameSync(temporary, path);
}

export class ProjectStore {
  constructor(readonly cwd: string) {}

  get projectsRoot(): string {
    return join(this.cwd, ".pi", "projects");
  }

  private runtimeRoot(): string {
    return join(this.cwd, ".pi", "runtime");
  }

  private projectPath(projectId: string): string {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,63})$/.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
    return join(this.projectsRoot, projectId);
  }

  private metadataPath(projectId: string): string {
    return join(this.projectPath(projectId), "project.json");
  }

  visionPath(projectId: string): string {
    return join(this.projectPath(projectId), "PROJECT.md");
  }

  planPath(projectId: string): string {
    return join(this.projectPath(projectId), "PLAN.md");
  }

  explorationPath(branchId: string): string {
    return join(this.runtimeRoot(), "explorations", branchId);
  }

  decisionPaths(projectId: string, decisionIds: string[]): string[] {
    const directory = join(this.projectPath(projectId), "decisions");
    if (!existsSync(directory)) return [];
    const entries = readdirSync(directory, { withFileTypes: true });
    return decisionIds.flatMap((decisionId) => {
      if (!/^DEC-\d+$/.test(decisionId)) return [];
      const entry = entries.find((candidate) => candidate.isFile() && candidate.name.startsWith(`${decisionId}-`));
      return entry ? [join(directory, entry.name)] : [];
    });
  }

  private withLock<T>(projectId: string, operation: () => T): T {
    this.projectPath(projectId);
    const lockDirectory = join(this.runtimeRoot(), "locks");
    const lockPath = join(lockDirectory, `${projectId}.lock`);
    mkdirSync(lockDirectory, { recursive: true });

    if (existsSync(lockPath) && Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
      unlinkSync(lockPath);
    }

    let descriptor: number;
    try {
      descriptor = openSync(lockPath, "wx");
      writeFileSync(descriptor, `${process.pid}\n${now()}\n`, "utf8");
    } catch {
      throw new Error(`Project ${projectId} is being updated by another Pi session. Retry shortly.`);
    }

    try {
      return operation();
    } finally {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    }
  }

  listProjects(): ProjectRecord[] {
    if (!existsSync(this.projectsRoot)) return [];
    return readdirSync(this.projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        try {
          return [this.readProject(entry.name)];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
  }

  readProject(projectId: string): ProjectRecord {
    const path = this.projectPath(projectId);
    let metadata = JSON.parse(readFileSync(this.metadataPath(projectId), "utf8")) as ProjectMetadata;
    const plan = readFileSync(this.planPath(projectId), "utf8");
    if (metadata.schemaVersion !== 1 || metadata.id !== projectId || !metadata.planHash) {
      throw new Error(`Unsupported project metadata: ${this.metadataPath(projectId)}`);
    }

    const projectPath = this.visionPath(projectId);
    const projectMarkdown = existsSync(projectPath)
      ? readFileSync(projectPath, "utf8")
      : projectVisionTemplate(metadata.title);
    if (!existsSync(projectPath)) atomicWrite(projectPath, projectMarkdown);
    if (!metadata.projectHash) {
      metadata = { ...metadata, projectHash: contentHash(projectMarkdown) };
      atomicWrite(this.metadataPath(projectId), `${JSON.stringify(metadata, null, 2)}\n`);
    }

    return { metadata, projectMarkdown, plan, path };
  }

  createProject(title: string): ProjectRecord {
    mkdirSync(this.projectsRoot, { recursive: true });
    const piIgnore = join(this.cwd, ".pi", ".gitignore");
    const ignoreContent = existsSync(piIgnore) ? readFileSync(piIgnore, "utf8") : "";
    if (!ignoreContent.split("\n").includes("runtime/")) {
      atomicWrite(piIgnore, `${ignoreContent.trimEnd()}${ignoreContent.trim() ? "\n" : ""}runtime/\n`);
    }
    const baseId = slugify(title);
    let projectId = baseId;
    let suffix = 2;
    while (existsSync(this.projectPath(projectId))) projectId = `${baseId}-${suffix++}`;

    const timestamp = now();
    const projectMarkdown = projectVisionTemplate(title);
    const plan = projectPlanTemplate(title);
    const metadata: ProjectMetadata = {
      schemaVersion: 1,
      id: projectId,
      title,
      status: "active",
      revision: 0,
      projectHash: contentHash(projectMarkdown),
      planHash: contentHash(plan),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const path = this.projectPath(projectId);
    mkdirSync(join(path, "branches"), { recursive: true });
    mkdirSync(join(path, "decisions"), { recursive: true });
    mkdirSync(join(path, "archive"), { recursive: true });
    atomicWrite(this.metadataPath(projectId), `${JSON.stringify(metadata, null, 2)}\n`);
    atomicWrite(this.visionPath(projectId), projectMarkdown);
    atomicWrite(this.planPath(projectId), plan);
    return { metadata, projectMarkdown, plan, path };
  }

  listBranches(projectId: string, includeArchive = false): BranchDocument[] {
    const directories = [join(this.projectPath(projectId), "branches")];
    if (includeArchive) directories.push(join(this.projectPath(projectId), "archive"));
    return directories.flatMap((directory) => {
      if (!existsSync(directory)) return [];
      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => {
          const path = join(directory, entry.name);
          return parseBranch(readFileSync(path, "utf8"), path);
        });
    }).sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
  }

  readBranch(projectId: string, branchId: string): BranchDocument {
    const branch = this.listBranches(projectId, true).find((candidate) => candidate.metadata.id === branchId);
    if (!branch) throw new Error(`Project branch not found: ${branchId}`);
    return branch;
  }

  createBranch(projectId: string, type: BranchType, title: string, options: CreateBranchOptions = {}): BranchDocument {
    return this.withLock(projectId, () => {
      const project = this.readProject(projectId);
      const all = this.listBranches(projectId, true);
      const next = all.reduce((max, branch) => Math.max(max, Number(branch.metadata.id.split("-")[1]) || 0), 0) + 1;
      const prefix = type === "explore" ? "EXP" : "WORK";
      const id = `${prefix}-${String(next).padStart(3, "0")}`;
      const timestamp = now();
      const markdown = branchTemplate(type, title, options);
      const metadata: BranchMetadata = {
        schemaVersion: 1,
        id,
        projectId,
        type,
        title,
        status: "active",
        baseRevision: project.metadata.revision,
        revision: 0,
        contentHash: contentHash(normalizedMarkdown(markdown)),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(options.relatedGoal ? { relatedGoal: options.relatedGoal } : {}),
        ...(options.relatedMilestone ? { relatedMilestone: options.relatedMilestone } : {}),
        ...(options.fromBranchId ? { fromBranchId: options.fromBranchId } : {}),
        ...(options.sourceBranchIds?.length ? { sourceBranchIds: options.sourceBranchIds } : {}),
        ...(options.sourceDecisionIds?.length ? { sourceDecisionIds: options.sourceDecisionIds } : {}),
      };
      const path = join(this.projectPath(projectId), "branches", `${id}-${slugify(title)}.md`);
      atomicWrite(path, serializeBranch(metadata, markdown));
      if (type === "explore") mkdirSync(this.explorationPath(id), { recursive: true });
      return { metadata, markdown, path };
    });
  }

  checkpointBranch(projectId: string, branchId: string, expectedRevision: number, markdown: string): BranchDocument {
    return this.withLock(projectId, () => {
      let branch = this.readBranch(projectId, branchId);
      if (branch.metadata.status !== "active") throw new Error(`Branch ${branchId} is already ${branch.metadata.status}.`);
      const actualHash = contentHash(normalizedMarkdown(branch.markdown));
      if (branch.metadata.contentHash !== actualHash) {
        const reconciledMetadata: BranchMetadata = {
          ...branch.metadata,
          revision: branch.metadata.revision + 1,
          contentHash: actualHash,
          updatedAt: now(),
        };
        atomicWrite(branch.path, serializeBranch(reconciledMetadata, branch.markdown));
        branch = { ...branch, metadata: reconciledMetadata };
        throw new BranchRevisionConflict(branch);
      }
      if (branch.metadata.revision !== expectedRevision) throw new BranchRevisionConflict(branch);
      const finalMarkdown = normalizedMarkdown(markdown);
      const metadata = {
        ...branch.metadata,
        revision: branch.metadata.revision + 1,
        contentHash: contentHash(finalMarkdown),
        updatedAt: now(),
      };
      atomicWrite(branch.path, serializeBranch(metadata, finalMarkdown));
      return { metadata, markdown: finalMarkdown.trim(), path: branch.path };
    });
  }

  integrateBranch(projectId: string, branchId: string, input: IntegrationInput): {
    project: ProjectRecord;
    branch: BranchDocument;
    decisionPath?: string;
  } {
    return this.withLock(projectId, () => {
      const project = this.readProject(projectId);
      let branch = this.readBranch(projectId, branchId);
      if (branch.metadata.status !== "active") throw new Error(`Branch ${branchId} is already ${branch.metadata.status}.`);
      const actualBranchHash = contentHash(normalizedMarkdown(branch.markdown));
      if (branch.metadata.contentHash !== actualBranchHash) {
        const reconciledMetadata: BranchMetadata = {
          ...branch.metadata,
          revision: branch.metadata.revision + 1,
          contentHash: actualBranchHash,
          updatedAt: now(),
        };
        atomicWrite(branch.path, serializeBranch(reconciledMetadata, branch.markdown));
        branch = { ...branch, metadata: reconciledMetadata };
        throw new BranchRevisionConflict(branch);
      }
      if (branch.metadata.revision !== input.expectedBranchRevision) throw new BranchRevisionConflict(branch);
      const actualProjectHash = contentHash(project.projectMarkdown);
      const actualPlanHash = contentHash(project.plan);
      if (project.metadata.projectHash !== actualProjectHash || project.metadata.planHash !== actualPlanHash) {
        const reconciledMetadata: ProjectMetadata = {
          ...project.metadata,
          revision: project.metadata.revision + 1,
          projectHash: actualProjectHash,
          planHash: actualPlanHash,
          updatedAt: now(),
        };
        atomicWrite(this.metadataPath(projectId), `${JSON.stringify(reconciledMetadata, null, 2)}\n`);
        throw new ProjectRevisionConflict(reconciledMetadata, project.projectMarkdown, project.plan);
      }
      if (project.metadata.revision !== input.expectedProjectRevision) {
        throw new ProjectRevisionConflict(project.metadata, project.projectMarkdown, project.plan);
      }
      validateProject(input.projectMarkdown);
      validatePlan(input.planMarkdown);

      let decisionPath: string | undefined;
      if (input.decision) {
        const decisionDirectory = join(this.projectPath(projectId), "decisions");
        const next = readdirSync(decisionDirectory, { withFileTypes: true })
          .filter((entry) => entry.isFile() && /^DEC-\d+/.test(entry.name))
          .reduce((max, entry) => Math.max(max, Number(/^DEC-(\d+)/.exec(entry.name)?.[1]) || 0), 0) + 1;
        const decisionId = `DEC-${String(next).padStart(3, "0")}`;
        decisionPath = join(decisionDirectory, `${decisionId}-${slugify(input.decision.title)}.md`);
        atomicWrite(decisionPath, `# ${decisionId}: ${input.decision.title}\n\n${input.decision.markdown.trim()}\n`);
      }

      const timestamp = now();
      const finalBranchMarkdown = normalizedMarkdown(input.branchMarkdown);
      const decisionId = decisionPath ? /^DEC-\d+/.exec(basename(decisionPath))?.[0] : undefined;
      const sourceDecisionIds = [...new Set([
        ...(branch.metadata.sourceDecisionIds ?? []),
        ...(decisionId ? [decisionId] : []),
      ])];
      const branchMetadata: BranchMetadata = {
        ...branch.metadata,
        status: input.status,
        revision: branch.metadata.revision + 1,
        contentHash: contentHash(finalBranchMarkdown),
        updatedAt: timestamp,
        ...(sourceDecisionIds.length ? { sourceDecisionIds } : {}),
      };
      const archivePath = join(this.projectPath(projectId), "archive", basename(branch.path));
      atomicWrite(branch.path, serializeBranch(branchMetadata, finalBranchMarkdown));
      renameSync(branch.path, archivePath);

      const finalProjectMarkdown = input.projectMarkdown.trimEnd() + "\n";
      const finalPlan = input.planMarkdown.trimEnd() + "\n";
      const projectMetadata: ProjectMetadata = {
        ...project.metadata,
        status: input.projectStatus ?? project.metadata.status,
        revision: project.metadata.revision + 1,
        projectHash: contentHash(finalProjectMarkdown),
        planHash: contentHash(finalPlan),
        updatedAt: timestamp,
      };
      atomicWrite(this.visionPath(projectId), finalProjectMarkdown);
      atomicWrite(this.planPath(projectId), finalPlan);
      atomicWrite(this.metadataPath(projectId), `${JSON.stringify(projectMetadata, null, 2)}\n`);

      return {
        project: { metadata: projectMetadata, projectMarkdown: finalProjectMarkdown, plan: finalPlan, path: project.path },
        branch: { metadata: branchMetadata, markdown: finalBranchMarkdown.trim(), path: archivePath },
        decisionPath,
      };
    });
  }

  brief(projectId: string): string {
    const project = this.readProject(projectId);
    return projectBrief(project.metadata, project.projectMarkdown, project.plan, this.listBranches(projectId));
  }
}
