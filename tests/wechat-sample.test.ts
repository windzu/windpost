import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified, type Plugin } from "unified";
import rehypeFigureWrapper from "../src/markdown/render/plugins/rehype-figure-wrapper";
import { getAdapterPlugins } from "../src/markdown/render/adapters";

const SAMPLE_URL = new URL(
  "../src/wechat/sample-assets/her-sample.md",
  import.meta.url,
);
const SAMPLE_IMAGE_NAMES = [
  "her-crossroads.jpg",
  "her-violinist.jpg",
  "her-new-year.jpg",
  "her-beach.jpg",
] as const;

test("bundles the complete Her reference article and structural coverage", async () => {
  const markdown = await readFile(SAMPLE_URL, "utf8");
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeFigureWrapper);
  for (const plugin of getAdapterPlugins("wechat", {
    wechatLayout: {
      variant: "editorial",
      title: "我花了两年，才走出那段狼狈的日子",
      digest: "关于毕业、迷茫、自我怀疑，以及一次迟到的重新开始",
      accountName: "她观世界",
      author: "Miki",
      date: "2026-07-31",
    },
  })) {
    if (Array.isArray(plugin)) processor.use(plugin[0] as Plugin, plugin[1]);
    else processor.use(plugin as Plugin);
  }
  const html = String(await processor
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body));

  assert.match(markdown, /这个公众号过去叫「\*\*思辨园地\*\*」/);
  assert.match(markdown, /\*\*李勋康老师\*\*/);
  assert.match(markdown, /《\*\*2049：未来10000天的可能\*\*》/);
  assert.equal((html.match(/class="windpost-hero"/g) || []).length, 1);
  assert.equal((html.match(/class="windpost-chapter"/g) || []).length, 6);
  assert.equal((html.match(/class="windpost-block windpost-preface"/g) || []).length, 1);
  assert.equal((html.match(/class="windpost-block windpost-note"/g) || []).length, 2);
  assert.equal((html.match(/class="windpost-block windpost-reading"/g) || []).length, 1);
  assert.equal((html.match(/class="windpost-reading-point"/g) || []).length, 5);
  const readingBlock = html.match(
    /<section class="windpost-block windpost-reading"[\s\S]*?<\/section>/,
  )?.[0] || "";
  assert.doesNotMatch(readingBlock, /<(?:ul|ol|li)\b/);
  assert.equal((html.match(/class="windpost-block windpost-podcast"/g) || []).length, 1);
  assert.equal((html.match(/class="windpost-block windpost-end"/g) || []).length, 1);
  assert.equal((html.match(/<img\b/g) || []).length, 4);
  assert.equal((html.match(/<figcaption>/g) || []).length, 4);
  assert.equal((html.match(/class="windpost-cropped-image"/g) || []).length, 2);
  assert.doesNotMatch(html, /<ul>\s+<li/);
  assert.doesNotMatch(html, /<\/li>\s+<li/);
  assert.doesNotMatch(html, /<\/li>\s+<\/ul>/);
  assert.doesNotMatch(html, /\[!windpost-/);
});

test("bundled sample images are publishable and contain no device or GPS metadata", async () => {
  for (const name of SAMPLE_IMAGE_NAMES) {
    const url = new URL(`../src/wechat/sample-assets/${name}`, import.meta.url);
    const [info, bytes] = await Promise.all([stat(url), readFile(url)]);
    const searchable = bytes.toString("latin1");

    assert.ok(info.size < 1024 * 1024, `${name} must stay below the WeChat image limit`);
    assert.doesNotMatch(searchable, /GPS|iPhone 15|2025:08:25|Meitu/i);
  }
});
