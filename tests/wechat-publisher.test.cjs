const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractTokenFromUrl,
  replaceImageSources,
  sanitizeError,
} = require("../wechat-publisher.cjs");

test("extractTokenFromUrl reads the MP backend token", () => {
  assert.equal(
    extractTokenFromUrl("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=123456&lang=zh_CN"),
    "123456",
  );
  assert.equal(extractTokenFromUrl("https://mp.weixin.qq.com/"), "");
});

test("replaceImageSources only replaces mapped article images", () => {
  const html = '<p><img src="attachment://vault/a.png"><img src="https://mmbiz.qpic.cn/keep"></p>';
  const result = replaceImageSources(
    html,
    new Map([["attachment://vault/a.png", "https://mmbiz.qpic.cn/new?a=1&b=2"]]),
  );
  assert.equal(
    result,
    '<p><img src="https://mmbiz.qpic.cn/new?a=1&amp;b=2"><img src="https://mmbiz.qpic.cn/keep"></p>',
  );
});

test("sanitizeError redacts browser session credentials from URLs", () => {
  const error = "failed https://mp.weixin.qq.com/a?token=123&ticket=secret&ticket_id=user";
  assert.equal(
    sanitizeError(error),
    "failed https://mp.weixin.qq.com/a?token=[redacted]&ticket=[redacted]&ticket_id=[redacted]",
  );
});
