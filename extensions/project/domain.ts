export type ProjectStatus = "active" | "completed" | "archived";
export type BranchType = "explore" | "work";
export type BranchStatus = "active" | "adopted" | "rejected" | "inconclusive" | "completed";

export type ProjectMetadata = {
  schemaVersion: 1;
  id: string;
  title: string;
  status: ProjectStatus;
  revision: number;
  projectHash: string;
  planHash: string;
  createdAt: string;
  updatedAt: string;
};

export type BranchMetadata = {
  schemaVersion: 1;
  id: string;
  projectId: string;
  type: BranchType;
  title: string;
  status: BranchStatus;
  baseRevision: number;
  revision: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

export type BranchDocument = {
  metadata: BranchMetadata;
  markdown: string;
  path: string;
};

const BRANCH_MARKER = "pi-project-branch";

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "project";
}

export function projectVisionTemplate(title: string): string {
  return `# ${title}\n\n## Vision\n\n_What future are we trying to create, beyond the first milestone?_\n\n## Intended experience\n\n_What should using the completed system feel like?_\n\n## System shape\n\n_What enduring capabilities and boundaries define the envisioned system?_\n\n## Principles\n\n- _Record durable principles that should guide milestone decisions._\n\n## Long-term success\n\n- [ ] Define evidence that the vision has materially become real\n\n## Non-goals\n\n- _What should this project deliberately never become?_\n\n## Milestone horizon\n\n1. _First meaningful end-to-end capability._\n2. _Next platform or product capability._\n3. _Later expansion._\n`;
}

export function projectPlanTemplate(title: string): string {
  return `# ${title}\n\n> **Status:** Active  \n> **Vision:** See PROJECT.md  \n> **Now:** Establish the project direction  \n> **Next:** Resolve the most important uncertainty  \n> **Blockers:** None recorded  \n> **Last decision:** Project created  \n> **Next action:** Clarify the vision, outcome, and success evidence\n\n## Outcome\n\n_What meaningful change should the current project horizon create?_\n\n## Success evidence\n\n- [ ] Define observable evidence that the current outcome has been achieved\n\n## Constraints and non-goals\n\n- _Record current boundaries without shrinking the PROJECT.md vision._\n\n## Now\n\nClarify the vision, outcome, evidence, and highest-risk uncertainty.\n\n## Next\n\n- Explore the highest-risk uncertainty or commit one bounded work outcome.\n\n## Later\n\n- _Keep distant milestones aligned with PROJECT.md and coarse until needed._\n\n## Open questions\n\n- What must we learn before making the next commitment?\n\n## Decisions\n\n- Project created.\n`;
}

export function branchTemplate(type: BranchType, title: string): string {
  if (type === "explore") {
    return `# ${title}\n\n## Question\n\n_What specific uncertainty are we reducing?_\n\n## Decision this unlocks\n\n_What can we decide after learning this?_\n\n## Appetite and safety boundary\n\n_Time, cost, and what must remain disposable or untouched._\n\n## Hypotheses or options\n\n- _A coherent possibility to investigate._\n\n## Method\n\n_Research, benchmark, interview, prototype, or disposable POC._\n\n## Evidence\n\n_Record observations, including surprising or negative results._\n\n## Conclusion\n\n_Pending: adopt, reject, or continue exploring._\n\n## Impact on project\n\n_How should the project plan change?_\n`;
  }

  return `# ${title}\n\n## Outcome\n\n_What verified project increment will this branch produce?_\n\n## Why now\n\n_Why is this the best next commitment?_\n\n## Scope\n\n- _The smallest meaningful slice._\n\n## Non-goals\n\n- _Explicitly excluded work._\n\n## Done when\n\n- [ ] Define observable completion evidence\n\n## Progress\n\n_Record material checkpoints, not a transcript._\n\n## Verification\n\n_Commands, tests, review, or other evidence._\n\n## Result\n\n_Pending._\n`;
}

export function serializeBranch(metadata: BranchMetadata, markdown: string): string {
  const marker = `<!-- ${BRANCH_MARKER} ${JSON.stringify(metadata)} -->`;
  return `${marker}\n\n${markdown.trim()}\n`;
}

export function parseBranch(content: string, path: string): BranchDocument {
  const firstLine = content.split("\n", 1)[0] ?? "";
  const match = /^<!-- pi-project-branch (\{.*\}) -->$/.exec(firstLine);
  if (!match?.[1]) throw new Error(`Invalid project branch metadata: ${path}`);
  const metadata = JSON.parse(match[1]) as BranchMetadata;
  if (metadata.schemaVersion !== 1 || !metadata.id || !metadata.projectId || !metadata.type || !metadata.contentHash) {
    throw new Error(`Unsupported project branch metadata: ${path}`);
  }
  const markdown = content.slice(firstLine.length).trimStart();
  return { metadata, markdown, path };
}

export function validateProject(markdown: string): void {
  const required = ["# ", "## Vision", "## Principles", "## Long-term success", "## Milestone horizon"];
  const missing = required.filter((heading) => !markdown.includes(heading));
  if (missing.length) throw new Error(`PROJECT.md is missing required sections: ${missing.join(", ")}`);
}

export function validatePlan(markdown: string): void {
  const required = ["# ", "## Outcome", "## Success evidence", "## Now", "## Next", "## Later"];
  const missing = required.filter((heading) => !markdown.includes(heading));
  if (missing.length) throw new Error(`PLAN.md is missing required sections: ${missing.join(", ")}`);
}

function section(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^## ${escaped}\\s*$\\n+([\\s\\S]*?)(?=^## |\\s*$)`, "m").exec(markdown);
  if (!match?.[1]) return "Not defined";
  const lines = match[1].split("\n")
    .map((line) => line.replace(/^[-*]\s+(?:\[[ xX]\]\s+)?/, "").trim())
    .filter((line) => line && !line.startsWith("_"));
  return lines[0] ?? "Not defined";
}

function snapshotField(markdown: string, field: string): string | undefined {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^> \\*\\*${escaped}:\\*\\*\\s*(.+?)(?:\\s{2})?$`, "m").exec(markdown)?.[1]?.trim();
}

export function projectBrief(metadata: ProjectMetadata, plan: string, branches: BranchDocument[]): string {
  const active = branches.filter((branch) => branch.metadata.status === "active");
  const exploring = active.filter((branch) => branch.metadata.type === "explore");
  const working = active.filter((branch) => branch.metadata.type === "work");
  const branchLine = [
    working.length ? `${working.length} work` : undefined,
    exploring.length ? `${exploring.length} explore` : undefined,
  ].filter(Boolean).join(" · ") || "none";

  return [
    `${metadata.title} [${metadata.status.toUpperCase()}] · revision ${metadata.revision}`,
    `Outcome: ${section(plan, "Outcome")}`,
    `Now: ${snapshotField(plan, "Now") ?? section(plan, "Now")}`,
    `Branches: ${branchLine}`,
    `Blockers: ${snapshotField(plan, "Blockers") ?? "None recorded"}`,
    `Next action: ${snapshotField(plan, "Next action") ?? "Review the plan"}`,
  ].join("\n");
}
