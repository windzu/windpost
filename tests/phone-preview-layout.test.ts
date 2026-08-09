import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePhonePreviewLayout,
  PHONE_FRAME_HEIGHT,
  PHONE_FRAME_WIDTH,
  PHONE_SCREEN_WIDTH,
} from "../src/components/PhoneMockup";

test("phone preview keeps a fixed layout viewport while fitting by width", () => {
  const layout = calculatePhonePreviewLayout(332, 1_000);

  assert.equal(layout.scale, 0.8);
  assert.equal(layout.stageWidth, 332);
  assert.equal(layout.stageHeight, 680);
  assert.equal(layout.frameWidth, PHONE_FRAME_WIDTH);
  assert.equal(layout.frameHeight, PHONE_FRAME_HEIGHT);
  assert.equal(layout.screenWidth, PHONE_SCREEN_WIDTH);
  assert.equal(layout.transform, "scale(0.8)");
});

test("phone preview keeps the same viewport while fitting by height", () => {
  const layout = calculatePhonePreviewLayout(1_000, 425);

  assert.equal(layout.scale, 0.5);
  assert.equal(layout.stageWidth, 207.5);
  assert.equal(layout.stageHeight, 425);
  assert.equal(layout.frameWidth, 415);
  assert.equal(layout.frameHeight, 850);
  assert.equal(layout.screenWidth, 375);
});

test("phone preview never enlarges beyond its reference size", () => {
  const layout = calculatePhonePreviewLayout(1_200, 1_200);

  assert.equal(layout.scale, 1);
  assert.equal(layout.stageWidth, PHONE_FRAME_WIDTH);
  assert.equal(layout.stageHeight, PHONE_FRAME_HEIGHT);
});
