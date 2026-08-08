import assert from "node:assert/strict";
import test from "node:test";
import { arrayBufferToBase64 } from "../src/base64";

test("encodes arbitrary binary data as base64", () => {
  const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
  assert.equal(arrayBufferToBase64(bytes.buffer), "AAECf4D+/w==");
});

test("encodes data larger than one conversion chunk", () => {
  const bytes = new Uint8Array(0x8000 + 3);
  bytes.set([65, 66, 67], 0x8000);
  const decoded = Uint8Array.from(atob(arrayBufferToBase64(bytes.buffer)), (char) => char.charCodeAt(0));
  assert.deepEqual(decoded, bytes);
});
