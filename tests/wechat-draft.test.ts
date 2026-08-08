import assert from "node:assert/strict";
import test from "node:test";
import { buildWechatArticle } from "../src/wechat/article";
import {
  countWechatContentCharacters,
  validateWechatContent,
} from "../src/wechat/validation";
import type { WechatPost } from "../src/wechat/types";

const post: WechatPost = {
  title: "标题",
  author: "作者",
  digest: "摘要",
  contentHtml: "<p>正文</p>",
  contentSourceUrl: "https://example.com/source",
  coverSource: null,
  needOpenComment: 1,
  onlyFansCanComment: 0,
};

test("buildWechatArticle assigns the cover through thumb_media_id", () => {
  assert.deepEqual(buildWechatArticle(post, "<p>正文</p>", "cover-media-id"), {
    article_type: "news",
    title: "标题",
    author: "作者",
    digest: "摘要",
    content: "<p>正文</p>",
    content_source_url: "https://example.com/source",
    thumb_media_id: "cover-media-id",
    need_open_comment: 1,
    only_fans_can_comment: 0,
  });
});

test("visible character count ignores HTML, CSS, scripts and comments", () => {
  const html = `<style>${".a{color:red}".repeat(3000)}</style><!-- hidden --><p>你&amp;好</p><script>ignored</script>`;
  assert.equal(countWechatContentCharacters(html), 3);
  assert.doesNotThrow(() => validateWechatContent(html));
});

test("visible character count rejects an actual 20,000-character article", () => {
  assert.throws(
    () => validateWechatContent(`<p>${"字".repeat(20_000)}</p>`),
    /可见文字为 20000 字符/,
  );
});

test("HTML payload still has an independent 1 MB limit", () => {
  assert.throws(
    () => validateWechatContent(`<style>${"x".repeat(1024 * 1024)}</style><p>短文</p>`),
    /HTML.*1 MB/,
  );
});
