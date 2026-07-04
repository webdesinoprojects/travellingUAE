import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerEsimDeliveryModel,
  isLpaActivationCode,
  resolveEsimQrPayload,
} from "./esim-activation.ts";
import { createQrMatrix } from "./qr-code.ts";

test("isLpaActivationCode accepts activation codes that start with LPA", () => {
  assert.equal(isLpaActivationCode("LPA:1$smdp$secret"), true);
  assert.equal(isLpaActivationCode("  lpa:1$smdp$secret  "), true);
  assert.equal(isLpaActivationCode("ACTIVATION"), false);
  assert.equal(isLpaActivationCode(null), false);
});

test("activation_code is preferred as QR payload when it starts with LPA", () => {
  assert.equal(
    resolveEsimQrPayload({
      activationCode: "LPA:1$smdp$from-activation",
      qrPayload: "LPA:1$smdp$from-qr",
    }),
    "LPA:1$smdp$from-activation",
  );
});

test("qr_payload fallback works when activation_code is not LPA", () => {
  assert.equal(
    resolveEsimQrPayload({
      activationCode: "plain-code",
      qrPayload: "LPA:1$smdp$from-qr",
    }),
    "LPA:1$smdp$from-qr",
  );
});

test("missing activation stays pending with no QR data", () => {
  const model = buildCustomerEsimDeliveryModel({
    status: "paid",
    activationCode: null,
    qrPayload: null,
    apn: "plus",
    simId: "iccid",
    providerOrderId: "12713137",
  });

  assert.deepEqual(model, {
    isReady: false,
    qrPayload: null,
    manualActivationCode: null,
    apn: null,
    simId: null,
    providerOrderId: null,
  });
});

test("fulfilled order exposes customer activation delivery fields", () => {
  const model = buildCustomerEsimDeliveryModel({
    status: "fulfilled",
    activationCode: "LPA:1$smdp$secret",
    qrPayload: null,
    apn: "plus",
    simId: "iccid",
    providerOrderId: "12713137",
  });

  assert.deepEqual(model, {
    isReady: true,
    qrPayload: "LPA:1$smdp$secret",
    manualActivationCode: "LPA:1$smdp$secret",
    apn: "plus",
    simId: "iccid",
    providerOrderId: "12713137",
  });
});

test("local QR generator returns a square matrix for an LPA activation code", () => {
  const matrix = createQrMatrix("LPA:1$smdp.example$matching-id");

  assert.ok(matrix);
  assert.equal(matrix.length, matrix[0].length);
  assert.equal(matrix.some((row) => row.some(Boolean)), true);
});
