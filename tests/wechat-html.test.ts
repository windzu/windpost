import assert from "node:assert/strict";
import test from "node:test";
import {
  extractImageSources,
  isWechatHostedImage,
  replaceImageSources,
  sourceToAsset,
} from "../src/wechat/html";

test("extractImageSources deduplicates and decodes HTML attributes", () => {
  const html = '<img src="attachment://vault/a%2Fb.png"><img src="https://a.test/x?a=1&amp;b=2"><img src="attachment://vault/a%2Fb.png">';
  assert.deepEqual(extractImageSources(html), [
    "attachment://vault/a%2Fb.png",
    "https://a.test/x?a=1&b=2",
  ]);
});

test("replaceImageSources preserves unrelated images", () => {
  const html = '<img alt="a" src="attachment://vault/a.png"><img src="https://mmbiz.qpic.cn/x">';
  const result = replaceImageSources(
    html,
    new Map([["attachment://vault/a.png", "https://mmbiz.qpic.cn/new?a=1&b=2"]]),
  );
  assert.equal(
    result,
    '<img alt="a" src="https://mmbiz.qpic.cn/new?a=1&amp;b=2"><img src="https://mmbiz.qpic.cn/x">',
  );
});

test("sourceToAsset resolves WindPost vault URLs", () => {
  assert.deepEqual(sourceToAsset("attachment://vault/assets%2Fcover.png"), {
    kind: "vault",
    path: "assets/cover.png",
  });
  assert.equal(sourceToAsset("app://local/file.png"), null);
});

test("isWechatHostedImage only accepts the WeChat image host", () => {
  assert.equal(isWechatHostedImage("https://mmbiz.qpic.cn/a"), true);
  assert.equal(isWechatHostedImage("https://evil-mmbiz.qpic.cn/a"), false);
});
