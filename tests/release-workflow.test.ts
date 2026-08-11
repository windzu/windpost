import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";

const root = path.resolve(import.meta.dirname, "..");
const read = (name: string) => fs.readFileSync(path.join(root, name), "utf8");

test("release workflow owns versioning, validation, merge and publication", () => {
  const source = read(".github/workflows/release.yml");
  const workflow: unknown = YAML.parse(source);
  assert.ok(isRecord(workflow));
  assert.ok(isRecord(workflow.on));
  assert.ok(isRecord(workflow.on.push));
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.ok("workflow_dispatch" in workflow.on);
  assert.ok(isRecord(workflow.permissions));
  assert.equal(workflow.permissions.actions, "write");
  assert.match(source, /googleapis\/release-please-action@v4/);
  assert.match(source, /gh workflow run ci\.yml/);
  assert.match(source, /gh pr merge .*--squash --delete-branch/);
  assert.match(source, /gh workflow run release\.yml --ref main -f finalize=true/);
  assert.match(source, /gh release upload .*--clobber/s);
});

test("Release Please updates both package and Obsidian manifest versions", () => {
  const config: unknown = JSON.parse(read("release-please-config.json"));
  const manifest: unknown = JSON.parse(read(".release-please-manifest.json"));
  assert.ok(isRecord(config));
  assert.ok(isRecord(config.packages));
  assert.ok(isRecord(config.packages["."]));
  assert.ok(isRecord(manifest));
  assert.equal(config["release-type"], "node");
  assert.equal(config["include-v-in-tag"], false);
  assert.deepEqual(config.packages["."]["extra-files"], [
    { type: "json", path: "manifest.json", jsonpath: "$.version" },
  ]);
  assert.equal(manifest["."], "1.0.3");
});

test("CI supports explicit validation of Action-created release branches", () => {
  const source = read(".github/workflows/ci.yml");
  const workflow: unknown = YAML.parse(source);
  assert.ok(isRecord(workflow));
  assert.ok(isRecord(workflow.on));
  assert.ok("workflow_dispatch" in workflow.on);
  assert.match(source, /run: pnpm check/);
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
