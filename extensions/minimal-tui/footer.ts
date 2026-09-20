import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export function layoutMinimalFooter(width: number, details: string): string {
  const content = truncateToWidth(details, width, "");
  const padding = " ".repeat(Math.max(0, width - visibleWidth(content)));
  return `${padding}${content}`;
}
