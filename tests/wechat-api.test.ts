import assert from "node:assert/strict";
import test from "node:test";
import type { RequestUrlParam } from "obsidian";
import { WechatApiClient, type WechatRequest } from "../src/wechat/api";

function response(value: Record<string, unknown>, status = 200) {
  return { status, text: JSON.stringify(value) };
}

test("WechatApiClient uses one stable token across the official draft flow", async () => {
  const requests: RequestUrlParam[] = [];
  const send: WechatRequest = async (request) => {
    requests.push(request);
    if (request.url.endsWith("/cgi-bin/stable_token")) {
      return response({ access_token: "token-1", expires_in: 7200 });
    }
    if (request.url.includes("/cgi-bin/draft/count")) return response({ total_count: 7 });
    if (request.url.includes("/cgi-bin/media/uploadimg")) {
      return response({ url: "https://mmbiz.qpic.cn/article" });
    }
    if (request.url.includes("/cgi-bin/material/add_material")) {
      return response({ media_id: "cover-media-id" });
    }
    if (request.url.includes("/cgi-bin/draft/add")) return response({ media_id: "draft-id" });
    throw new Error(`Unexpected request: ${request.url}`);
  };
  const client = new WechatApiClient("appid", "secret", send);
  const file = {
    field: "media",
    filename: "cover.jpg",
    contentType: "image/jpeg",
    data: new Uint8Array([1, 2, 3]).buffer,
  };

  assert.equal(await client.getDraftCount(), 7);
  assert.equal(await client.uploadArticleImage(file), "https://mmbiz.qpic.cn/article");
  assert.equal(await client.uploadPermanentImage(file), "cover-media-id");
  assert.equal(await client.addDraft({ thumb_media_id: "cover-media-id" }), "draft-id");

  assert.equal(requests.filter((item) => item.url.endsWith("/cgi-bin/stable_token")).length, 1);
  const tokenBody = JSON.parse(String(requests[0].body));
  assert.deepEqual(tokenBody, {
    grant_type: "client_credential",
    appid: "appid",
    secret: "secret",
    force_refresh: false,
  });
  const material = requests.find((item) => item.url.includes("/cgi-bin/material/add_material"));
  assert.match(material?.url || "", /[?&]type=image(?:&|$)/);
  const multipart = new TextDecoder().decode(material?.body as ArrayBuffer);
  assert.match(multipart, /name="media"; filename="cover.jpg"/);
});

test("WechatApiClient refreshes an expired token once", async () => {
  let tokenCalls = 0;
  let countCalls = 0;
  const send: WechatRequest = async (request) => {
    if (request.url.endsWith("/cgi-bin/stable_token")) {
      tokenCalls += 1;
      return response({ access_token: `token-${tokenCalls}`, expires_in: 7200 });
    }
    countCalls += 1;
    return countCalls === 1
      ? response({ errcode: 42001, errmsg: "access_token expired" })
      : response({ total_count: 2 });
  };

  const client = new WechatApiClient("appid", "secret", send);
  assert.equal(await client.getDraftCount(), 2);
  assert.equal(tokenCalls, 2);
  assert.equal(countCalls, 2);
});

test("WechatApiClient explains an IP whitelist rejection", async () => {
  const send: WechatRequest = async (request) => request.url.endsWith("/cgi-bin/stable_token")
    ? response({ access_token: "token", expires_in: 7200 })
    : response({ errcode: 40164, errmsg: "invalid ip" });
  const client = new WechatApiClient("appid", "secret", send);
  await assert.rejects(() => client.getDraftCount(), /出口 IP.*白名单/);
});

test("WechatApiClient does not expose credentials from network failures", async () => {
  const send: WechatRequest = async () => {
    throw new Error("failed: access_token=sensitive-token&secret=sensitive-secret");
  };
  const client = new WechatApiClient("appid", "sensitive-secret", send);
  await assert.rejects(
    () => client.getDraftCount(),
    (error: Error) => {
      assert.match(error.message, /网络请求失败/);
      assert.doesNotMatch(error.message, /sensitive/);
      return true;
    },
  );
});
