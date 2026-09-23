import { basename } from "node:path";

export type ProjectArea = "explore" | "work";

export type ProjectDocument = {
  id: string;
  title: string;
  markdown: string;
  path: string;
};

function cleanSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "No current status recorded.";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

export function projectTemplate(title: string): string {
  return `# ${title}\n\n## Vision\n\n_What lasting outcome are we creating?_\n\n## Direction\n\n_What are we doing next, and why?_\n\n## Current status\n\nNot started.\n`;
}

export function exploreTemplate(title: string): string {
  return `# ${title}\n\n## Question\n\n_What uncertainty are we reducing?_\n\n## Approach\n\n_Research, prototype, or experiment._\n\n## Findings\n\n_Record evidence and observations._\n\n## Conclusion\n\n_What should the project do as a result?_\n`;
}

export function workTemplate(title: string): string {
  return `# ${title}\n\n## Plan\n\n_The smallest useful implementation plan._\n\n## Implementation\n\n_What changed?_\n\n## Results\n\n_What happened?_\n\n## Verification\n\n_Commands, tests, or review evidence._\n`;
}

export function projectTitle(markdown: string, path: string): string {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || basename(path, ".md");
}

export function currentStatus(markdown: string): string {
  const match = /##\s+Current status\s*\n+([\s\S]*?)(?=\n##\s|$)/i.exec(markdown);
  return cleanSentence(match?.[1] ?? "");
}
