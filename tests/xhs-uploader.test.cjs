const assert = require("node:assert/strict");
const test = require("node:test");

const { fillTopics, normalizeTags } = require("../xhs-uploader.cjs");

test("normalizeTags removes hashes, blanks, and duplicates", () => {
  assert.deepEqual(
    normalizeTags(["#自动驾驶", " 端到端 ", "自动驾驶", "###", ""]),
    ["自动驾驶", "端到端"],
  );
});

test("fillTopics types and confirms each topic separately", async () => {
  const events = [];
  const editor = {
    async click() {
      events.push(["editor.click"]);
    },
    async evaluate() {
      events.push(["editor.end"]);
    },
  };
  const page = {
    keyboard: {
      async press(key) {
        events.push(["press", key]);
      },
      async type(value, options) {
        events.push(["type", value, options]);
      },
    },
    async waitForTimeout(timeout) {
      events.push(["timeout", timeout]);
    },
    async waitForFunction(_predicate, args, options) {
      events.push(["wait", args.tag, args.expectedVisible, options.timeout]);
    },
  };

  await fillTopics(page, editor, ["自动驾驶", "#端到端"]);

  assert.deepEqual(events, [
    ["editor.click"],
    ["editor.end"],
    ["press", "Enter"],
    ["press", "Enter"],
    ["type", "#", undefined],
    ["timeout", 150],
    ["type", "自动驾驶", { delay: 50 }],
    ["wait", "自动驾驶", true, 5000],
    ["press", "Enter"],
    ["wait", "自动驾驶", false, 3000],
    ["type", " ", undefined],
    ["type", "#", undefined],
    ["timeout", 150],
    ["type", "端到端", { delay: 50 }],
    ["wait", "端到端", true, 5000],
    ["press", "Enter"],
    ["wait", "端到端", false, 3000],
    ["type", " ", undefined],
  ]);
});

test("fillTopics reports the tag when no suggestion appears", async () => {
  const editor = {
    async click() {},
    async evaluate() {},
  };
  const page = {
    keyboard: {
      async press() {},
      async type() {},
    },
    async waitForTimeout() {},
    async waitForFunction(_predicate, args) {
      if (args.expectedVisible) throw new Error("timeout");
    },
  };

  await assert.rejects(
    fillTopics(page, editor, ["不存在的话题"]),
    /未找到小红书话题候选：#不存在的话题/,
  );
});
