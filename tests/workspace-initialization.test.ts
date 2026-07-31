import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

const assetUrl = (name: string) => new URL(
  `../src/workspace/assets/${name}`,
  import.meta.url,
);

test("WindPost Base keeps only the irreducible publishing workflow fields", async () => {
  const template = await readFile(assetUrl("WindPost.base"), "utf8");
  const propertyIds = [...template.matchAll(/^  note\.([a-z_]+):$/gm)]
    .map((match) => match[1]);

  assert.match(template, /file\.folder == "Content"/);
  assert.deepEqual(propertyIds, ["stage", "channels", "published_to"]);
  assert.match(template, /name: 创作中/);
  assert.match(template, /name: 待发布/);
  assert.match(template, /name: 已完成/);
  assert.match(template, /name: 全部内容/);
  assert.doesNotMatch(template, /note\.(?:title|type|date|summary|format|cover_text)/);
});

test("longform sample works from minimum metadata and includes a WeChat cover", async () => {
  const markdown = await readFile(assetUrl("longform-sample.md"), "utf8");
  const frontmatter = parseFrontmatter(markdown);

  assert.equal(frontmatter.stage, "draft");
  assert.deepEqual(frontmatter.channels, ["blog", "wechat"]);
  assert.deepEqual(frontmatter.published_to, []);
  assert.equal(frontmatter.title, undefined);
  assert.equal(frontmatter.type, undefined);
  assert.equal(frontmatter.date, undefined);
  assert.equal(frontmatter.summary, undefined);
  assert.match(markdown, /^# WindPost 长内容示例$/m);
  assert.match(markdown, /!\[示例封面\]\(WindPost\/Examples\/Her\/assets\/her-crossroads\.jpg\)/);
});

test("shortform sample derives its cover text and title without extra fields", async () => {
  const markdown = await readFile(assetUrl("shortform-sample.md"), "utf8");
  const frontmatter = parseFrontmatter(markdown);

  assert.equal(frontmatter.stage, "draft");
  assert.deepEqual(frontmatter.channels, ["xiaohongshu"]);
  assert.deepEqual(frontmatter.published_to, []);
  assert.equal(frontmatter.title, undefined);
  assert.equal(frontmatter.type, undefined);
  assert.equal(frontmatter.cover_text, undefined);
  assert.match(markdown, /^# 我如何把一篇长文变成小红书$/m);
});

test("Her sample uses the same minimum common workflow fields", async () => {
  const markdown = await readFile(
    new URL("../src/wechat/sample-assets/her-sample.md", import.meta.url),
    "utf8",
  );
  const frontmatter = parseFrontmatter(markdown);

  assert.deepEqual(frontmatter, {
    stage: "draft",
    channels: ["wechat"],
    published_to: [],
  });
  assert.match(markdown, /^# 我花了两年，<br>才走出那段狼狈的日子$/m);
});

function parseFrontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "sample must contain frontmatter");
  return YAML.parse(match[1]) as Record<string, unknown>;
}
