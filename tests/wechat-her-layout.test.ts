import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import juice from "juice";

const resetCss = fs.readFileSync(
  new URL("../src/themes/markdown-style/reset.css", import.meta.url),
  "utf8",
);
const herCss = fs.readFileSync(
  new URL("../src/themes/wechat/her.css", import.meta.url),
  "utf8",
);

function inlineHer(html: string): string {
  return juice.inlineContent(`<section id="bm-md">${html}</section>`, resetCss + herCss, {
    inlinePseudoElements: true,
    preserveImportant: true,
  });
}

function styleFor(html: string, className: string): string {
  const match = html.match(new RegExp(`<[^>]+class="${className}"[^>]+style="([^"]+)"`));
  assert.ok(match, `missing inline style for ${className}`);
  return match[1];
}

test("Her full-width cards stay centered without negative horizontal margins", () => {
  const html = inlineHer(`
    <section class="windpost-hero"><p class="windpost-hero-kicker">HEADER</p></section>
    <section class="windpost-end"><p>FOOTER</p></section>
  `);
  const heroStyle = styleFor(html, "windpost-hero");
  const endStyle = styleFor(html, "windpost-end");

  assert.match(heroStyle, /width: 100%/);
  assert.match(heroStyle, /margin: 0 auto 44px/);
  assert.match(endStyle, /width: 100%/);
  assert.match(endStyle, /margin: 44px auto -52px/);
  assert.doesNotMatch(heroStyle, /margin: [^;]*-28px/);
  assert.doesNotMatch(endStyle, /margin: [^;]*-28px/);
});

test("Her article images retain automatic horizontal margins after inlining", () => {
  const html = inlineHer('<figure><img src="image.jpg" alt="示例"></figure>');
  const imageStyle = html.match(/<img[^>]+style="([^"]+)"/)?.[1] || "";

  assert.match(imageStyle, /display: block/);
  assert.match(imageStyle, /margin-left: auto/);
  assert.match(imageStyle, /margin-right: auto/);
});
