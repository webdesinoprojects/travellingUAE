import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateProviderBookingFlag } from "./flags.ts";

const ENABLED = {
  enabledFlag: "true",
  paymentModel: "hotel",
  ratehawkEnv: "test",
  providerConfigured: true,
};

test("flag enabled only when every condition holds", () => {
  const result = evaluateProviderBookingFlag(ENABLED);
  assert.deepEqual(result, { enabled: true, paymentModel: "hotel" });
});

test("flag accepts 'now' as a confirmed model", () => {
  const result = evaluateProviderBookingFlag({ ...ENABLED, paymentModel: "now" });
  assert.deepEqual(result, { enabled: true, paymentModel: "now" });
});

test("disabled when RATEHAWK_BOOKING_ENABLED is not 'true'", () => {
  const result = evaluateProviderBookingFlag({ ...ENABLED, enabledFlag: undefined });
  assert.equal(result.enabled, false);
  assert.ok(
    result.enabled === false &&
      result.reasons.some((r) => r.includes("RATEHAWK_BOOKING_ENABLED")),
  );
});

test("disabled in production even with everything else set", () => {
  for (const env of ["prod", "production", "PROD"]) {
    const result = evaluateProviderBookingFlag({ ...ENABLED, ratehawkEnv: env });
    assert.equal(result.enabled, false, env);
    assert.ok(
      result.enabled === false && result.reasons.some((r) => r.includes("production")),
    );
  }
});

test("disabled when payment model is unset or unconfirmed", () => {
  const unset = evaluateProviderBookingFlag({ ...ENABLED, paymentModel: undefined });
  assert.equal(unset.enabled, false);
  assert.ok(unset.enabled === false && unset.reasons.some((r) => r.includes("not configured")));

  const deposit = evaluateProviderBookingFlag({ ...ENABLED, paymentModel: "deposit" });
  assert.equal(deposit.enabled, false);
  assert.ok(
    deposit.enabled === false && deposit.reasons.some((r) => r.includes("not a confirmed model")),
  );
});

test("disabled when provider credentials are missing", () => {
  const result = evaluateProviderBookingFlag({ ...ENABLED, providerConfigured: false });
  assert.equal(result.enabled, false);
  assert.ok(result.enabled === false && result.reasons.some((r) => r.includes("credentials")));
});

test("collects all failing reasons at once", () => {
  const result = evaluateProviderBookingFlag({
    enabledFlag: "false",
    paymentModel: undefined,
    ratehawkEnv: "prod",
    providerConfigured: false,
  });
  assert.equal(result.enabled, false);
  assert.ok(result.enabled === false && result.reasons.length === 4);
});
