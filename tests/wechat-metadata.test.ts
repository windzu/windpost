import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWechatMetadataText } from "../src/wechat/metadata";

test("normalizes a visual line break out of the WeChat API title", () => {
  assert.equal(
    normalizeWechatMetadataText("我花了两年，<br>才走出那段狼狈的日子"),
    "我花了两年，才走出那段狼狈的日子",
  );
});

test("normalizes HTML and entities in WeChat metadata", () => {
  assert.equal(
    normalizeWechatMetadataText("<strong>她观世界</strong>&nbsp;&amp;&nbsp;WindPost"),
    "她观世界 & WindPost",
  );
});
