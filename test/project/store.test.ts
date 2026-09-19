import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { projectPlanTemplate } from "../../extensions/project/domain.ts";
import {
  BranchRevisionConflict,
  ProjectRevisionConflict,
  ProjectStore,
} from "../../extensions/project/store.ts";

test("project store manages independent branches and revision-safe integration", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-workbench-project-"));
  try {
    const store = new ProjectStore(cwd);
    const project = store.createProject("Replace passwords with passkeys");
    assert.equal(project.metadata.revision, 0);
    assert.equal(readFileSync(join(cwd, ".pi", ".gitignore"), "utf8"), "runtime/\n");
    assert.match(store.brief(project.metadata.id), /Outcome:/);

    const exploration = store.createBranch(project.metadata.id, "explore", "Test account recovery");
    const work = store.createBranch(project.metadata.id, "work", "Implement registration");
    assert.equal(exploration.metadata.id, "EXP-001");
    assert.equal(work.metadata.id, "WORK-002");
    assert.equal(store.listBranches(project.metadata.id).length, 2);

    const checkpoint = store.checkpointBranch(
      project.metadata.id,
      exploration.metadata.id,
      0,
      exploration.markdown.replace("_Pending: adopt, reject, or continue exploring._", "Adopt recovery codes."),
    );
    assert.equal(checkpoint.metadata.revision, 1);
    assert.throws(
      () => store.checkpointBranch(project.metadata.id, exploration.metadata.id, 0, checkpoint.markdown),
      BranchRevisionConflict,
    );

    const manuallyEditedBranch = readFileSync(exploration.path, "utf8")
      .replace("Adopt recovery codes.", "Adopt recovery codes after manual review.");
    writeFileSync(exploration.path, manuallyEditedBranch, "utf8");
    assert.throws(
      () => store.checkpointBranch(project.metadata.id, exploration.metadata.id, 1, checkpoint.markdown),
      BranchRevisionConflict,
    );
    const reconciledBranch = store.readBranch(project.metadata.id, exploration.metadata.id);
    assert.equal(reconciledBranch.metadata.revision, 2);

    const firstPlan = projectPlanTemplate(project.metadata.title)
      .replace("Establish the project direction", "Adopt recovery codes")
      .replace("Project created  ", "Use recovery codes  ");
    const integrated = store.integrateBranch(project.metadata.id, exploration.metadata.id, {
      expectedProjectRevision: 0,
      expectedBranchRevision: 2,
      branchMarkdown: reconciledBranch.markdown,
      planMarkdown: firstPlan,
      status: "adopted",
      decision: {
        title: "Use recovery codes",
        markdown: "## Context\nRecovery must survive device loss.\n\n## Decision\nUse one-time recovery codes.\n\n## Consequences\nCodes require secure storage.",
      },
    });
    assert.equal(integrated.project.metadata.revision, 1);
    assert.equal(integrated.branch.metadata.status, "adopted");
    assert.ok(integrated.decisionPath && existsSync(integrated.decisionPath));
    assert.equal(store.listBranches(project.metadata.id).length, 1);
    assert.equal(store.listBranches(project.metadata.id, true).length, 2);

    assert.throws(
      () => store.integrateBranch(project.metadata.id, work.metadata.id, {
        expectedProjectRevision: 0,
        expectedBranchRevision: 0,
        branchMarkdown: work.markdown,
        planMarkdown: firstPlan,
        status: "completed",
      }),
      ProjectRevisionConflict,
    );

    const latest = store.readProject(project.metadata.id);
    const manuallyEditedPlan = latest.plan.replace("## Open questions", "## Editor note\n\nClarified directly in LazyVim.\n\n## Open questions");
    writeFileSync(store.planPath(project.metadata.id), manuallyEditedPlan, "utf8");
    assert.throws(
      () => store.integrateBranch(project.metadata.id, work.metadata.id, {
        expectedProjectRevision: 1,
        expectedBranchRevision: 0,
        branchMarkdown: work.markdown,
        planMarkdown: manuallyEditedPlan,
        status: "completed",
      }),
      ProjectRevisionConflict,
    );

    const reconciled = store.readProject(project.metadata.id);
    assert.equal(reconciled.metadata.revision, 2);
    const secondPlan = reconciled.plan.replace("## Now\n\n", "## Now\n\nRegistration implemented and verified.\n\n");
    const second = store.integrateBranch(project.metadata.id, work.metadata.id, {
      expectedProjectRevision: 2,
      expectedBranchRevision: 0,
      branchMarkdown: work.markdown.replace("_Pending._", "Registration verified."),
      planMarkdown: secondPlan,
      status: "completed",
    });
    assert.equal(second.project.metadata.revision, 3);
    assert.match(readFileSync(store.planPath(project.metadata.id), "utf8"), /Registration implemented/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
