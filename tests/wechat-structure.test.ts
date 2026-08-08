import assert from "node:assert/strict";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import rehypeFigureWrapper from "../src/markdown/render/plugins/rehype-figure-wrapper";
import rehypeWindpostStructure from "../src/markdown/render/plugins/rehype-windpost-structure";

async function structure(markdown: string, editorial = true) {
  return String(await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeWindpostStructure, editorial
      ? {
          variant: "editorial",
          title: "标题",
          digest: "摘要",
          accountName: "她观世界",
          author: "Miki",
          date: "2026-07-31",
        }
      : { variant: "default" })
    .use(rehypeStringify)
    .process(markdown));
}

test("builds an editorial masthead from settings and public metadata", async () => {
  const html = await structure("# 标题\n\n> 摘要\n\n正文。");
  assert.match(html, /class="windpost-hero"/);
  assert.match(html, /她观世界 · NOTES ON BECOMING · 文\/Miki/);
  assert.match(html, /VOL\. 07 \/ 2026/);
  assert.equal((html.match(/>标题</g) || []).length, 1);
  assert.doesNotMatch(html, /<blockquote/);
});

test("turns WindPost directives into stable semantic sections", async () => {
  const html = await structure(`
> [!windpost-preface] 写在前面
>
> 前言正文。

## 第一章

> 「引语。」

> [!windpost-note]
>
> 说明。

> [!windpost-reading]
>
> - 第一条
> - 第二条

> [!windpost-podcast] PODCAST · EP01
>
> ### 《节目》
>
> 节目说明。

> [!windpost-end] READ · THINK · CREATE
>
> 她观世界
`, false);

  assert.match(html, /class="windpost-block windpost-preface"/);
  assert.match(html, /class="windpost-block windpost-note"/);
  assert.match(html, /class="windpost-block windpost-reading"/);
  assert.equal((html.match(/class="windpost-reading-point"/g) || []).length, 2);
  assert.equal((html.match(/class="windpost-reading-bullet"/g) || []).length, 2);
  assert.doesNotMatch(
    html.match(/class="windpost-block windpost-reading"[\s\S]*?<\/section>/)?.[0] || "",
    /<(?:ul|ol|li)\b/,
  );
  assert.match(html, /class="windpost-block windpost-podcast"/);
  assert.match(html, /class="windpost-block windpost-end"/);
  assert.match(html, /class="windpost-chapter" data-windpost-part="01"/);
  assert.match(html, /class="windpost-pull-quote"/);
  assert.equal((html.match(/class="windpost-quote-mark"/g) || []).length, 2);
  assert.doesNotMatch(html, /\[!windpost-/);
});

test("keeps default layout free of injected account branding", async () => {
  const html = await structure("# 标题\n\n正文。", false);
  assert.doesNotMatch(html, /windpost-hero/);
  assert.doesNotMatch(html, /NOTES ON BECOMING/);
});

test("uses the following italic paragraph as the image caption", async () => {
  const html = String(await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeFigureWrapper)
    .use(rehypeStringify)
    .process("![替代文本](image.jpg)\n\n*真正的图片题注*"));

  assert.match(html, /<figcaption>真正的图片题注<\/figcaption>/);
  assert.equal((html.match(/<figcaption>/g) || []).length, 1);
  assert.doesNotMatch(html, /<p><em>/);
});
