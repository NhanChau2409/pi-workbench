import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProjectStore } from "../../extensions/project/store.ts";

test("project store creates one project document with exploration and work folders", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-project-"));
  try {
    const store = new ProjectStore(cwd);
    const project = store.createProject("Build a personal agent");

    assert.equal(existsSync(project.path), true);
    assert.equal(existsSync(store.areaPath(project.id, "explore")), true);
    assert.equal(existsSync(store.areaPath(project.id, "work")), true);
    assert.match(readFileSync(project.path, "utf8"), /## Current status\n\nNot started\./);
    assert.equal(store.status(project.id), "Not started.");

    const exploration = store.createRecord(project.id, "explore", "Compare chat channels");
    const work = store.createRecord(project.id, "work", "Build Telegram integration");
    assert.match(exploration, /explore\/.*compare-chat-channels\.md$/);
    assert.match(work, /work\/.*build-telegram-integration\.md$/);
    assert.match(readFileSync(exploration, "utf8"), /## Findings/);
    assert.match(readFileSync(work, "utf8"), /## Verification/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
