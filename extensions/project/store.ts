import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  currentStatus,
  exploreTemplate,
  type ProjectArea,
  type ProjectDocument,
  projectTemplate,
  projectTitle,
  workTemplate,
} from "./domain.ts";

function slug(value: string): string {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return result || "project";
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").replace("Z", "");
}

export class ProjectStore {
  constructor(readonly cwd: string) {}

  private root(): string {
    return join(this.cwd, ".pi", "projects");
  }

  projectPath(id: string): string {
    return join(this.root(), id);
  }

  projectFile(id: string): string {
    return join(this.projectPath(id), "PROJECT.md");
  }

  areaPath(id: string, area: ProjectArea): string {
    return join(this.projectPath(id), area);
  }

  listProjects(): ProjectDocument[] {
    if (!existsSync(this.root())) return [];
    return readdirSync(this.root(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(this.projectFile(entry.name)))
      .map((entry) => this.readProject(entry.name))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  readProject(id: string): ProjectDocument {
    const path = this.projectFile(id);
    if (!existsSync(path)) throw new Error(`Project not found: ${id}`);
    const markdown = readFileSync(path, "utf8");
    return { id, title: projectTitle(markdown, path), markdown, path };
  }

  createProject(title: string): ProjectDocument {
    const base = slug(title);
    let id = base;
    let suffix = 2;
    while (existsSync(this.projectPath(id))) id = `${base}-${suffix++}`;
    mkdirSync(this.areaPath(id, "explore"), { recursive: true });
    mkdirSync(this.areaPath(id, "work"), { recursive: true });
    writeFileSync(this.projectFile(id), projectTemplate(title.trim()), "utf8");
    return this.readProject(id);
  }

  createRecord(id: string, area: ProjectArea, title: string): string {
    const directory = this.areaPath(id, area);
    if (!existsSync(this.projectFile(id))) throw new Error(`Project not found: ${id}`);
    mkdirSync(directory, { recursive: true });
    const base = `${timestamp()}-${slug(title)}.md`;
    let name = base;
    let suffix = 2;
    while (existsSync(join(directory, name))) name = base.replace(/\.md$/, `-${suffix++}.md`);
    const path = join(directory, name);
    writeFileSync(path, area === "explore" ? exploreTemplate(title.trim()) : workTemplate(title.trim()), "utf8");
    return path;
  }

  status(id: string): string {
    return currentStatus(this.readProject(id).markdown);
  }
}
