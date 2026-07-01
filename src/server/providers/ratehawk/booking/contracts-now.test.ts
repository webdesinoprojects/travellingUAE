import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCreateCreditCardTokenRequest,
  buildStartBookingRequest,
  buildStoredNowSelectedPayment,
  classifyCreditCardToken,
  decideStandalonePaymentSelection,
  generatePaymentUuid,
  isUuid,
  parseThreeDsRedirect,
  PAYOTA_ENDPOINTS,
  selectNowPaymentType,
  type ParsedPaymentType,
  type SelectedPaymentType,
} from "./contracts.ts";

const U1 = generatePaymentUuid();
const U2 = generatePaymentUuid();

const nowUsd: ParsedPaymentType = {
  type: "now",
  amount: "100.00",
  currencyCode: "USD",
  isNeedCreditCardData: true,
  isNeedCvc: true,
};
const nowEur: ParsedPaymentType = {
  type: "now",
  amount: "90.00",
  currencyCode: "EUR",
  isNeedCreditCardData: true,
  isNeedCvc: false,
};
const deposit: ParsedPaymentType = {
  type: "deposit",
  amount: "80.00",
  currencyCode: "USD",
  isNeedCreditCardData: false,
  isNeedCvc: false,
};

function validCardInput() {
  return {
    objectId: "item-123",
    payUuid: U1,
    initUuid: U2,
    userFirstName: "Ratehawk",
    userLastName: "Test",
    isCvcRequired: true,
    card: {
      cardNumber: "4111 1111 1111 1111",
      cardHolder: "RATEHAWK TEST",
      expiryMonth: "01",
      expiryYear: "30",
      cvc: "123",
    },
  };
}

test("PAYOTA endpoint path is the documented init_partners path", () => {
  assert.equal(PAYOTA_ENDPOINTS.createCreditCardToken, "/api/public/v1/manage/init_partners");
});

test("isUuid accepts generated uuids and rejects junk", () => {
  assert.equal(isUuid(generatePaymentUuid()), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(123), false);
});

test("buildCreateCreditCardTokenRequest builds the documented Payota shape", () => {
  const body = buildCreateCreditCardTokenRequest(validCardInput());

  assert.equal(body.object_id, "item-123");
  assert.equal(body.pay_uuid, U1);
  assert.equal(body.init_uuid, U2);
  assert.equal(body.user_first_name, "Ratehawk");
  assert.equal(body.user_last_name, "Test");
  assert.equal(body.is_cvc_required, true);
  assert.equal(body.cvc, "123");

  const core = body.credit_card_data_core as Record<string, unknown>;
  // Card number spaces are stripped to digits only.
  assert.equal(core.card_number, "4111111111111111");
  assert.equal(core.card_holder, "RATEHAWK TEST");
  assert.equal(core.month, "01");
  assert.equal(core.year, "30");
});

test("buildCreateCreditCardTokenRequest omits cvc when it is not required", () => {
  const input = validCardInput();
  input.isCvcRequired = false;
  const body = buildCreateCreditCardTokenRequest(input);
  assert.equal(body.is_cvc_required, false);
  assert.equal("cvc" in body, false);
});

test("buildCreateCreditCardTokenRequest rejects bad card/uuid/month input", () => {
  assert.throws(() => buildCreateCreditCardTokenRequest({ ...validCardInput(), payUuid: "bad" }));
  assert.throws(() =>
    buildCreateCreditCardTokenRequest({
      ...validCardInput(),
      card: { ...validCardInput().card, expiryMonth: "13" },
    }),
  );
  assert.throws(() =>
    buildCreateCreditCardTokenRequest({
      ...validCardInput(),
      card: { ...validCardInput().card, cardNumber: "12" },
    }),
  );
  assert.throws(() =>
    buildCreateCreditCardTokenRequest({ ...validCardInput(), isCvcRequired: true, card: { ...validCardInput().card, cvc: "" } }),
  );
});

test("buildStartBookingRequest (now) nests init_uuid/pay_uuid inside payment_type", () => {
  const body = buildStartBookingRequest({
    partner: { partnerOrderId: "po-1" },
    language: "en",
    user: { email: "guest@example.com" },
    rooms: [{ guests: [{ firstName: "Ratehawk", lastName: "Test" }] }],
    payment: {
      type: "now",
      amount: "100.00",
      currencyCode: "USD",
      initUuid: U1,
      payUuid: U2,
      returnPath: "https://example.com/return",
    },
  });

  // ETG requires init_uuid/pay_uuid INSIDE payment_type (not top-level), or it
  // rejects Start Booking with not_enough_credit_card_data.
  assert.deepEqual(body.payment_type, {
    type: "now",
    amount: "100.00",
    currency_code: "USD",
    init_uuid: U1,
    pay_uuid: U2,
  });
  assert.equal(body.return_path, "https://example.com/return");
  // Regression guard: must NOT be duplicated at the top level.
  assert.equal("init_uuid" in body, false);
  assert.equal("pay_uuid" in body, false);
});

test("stored camelCase selection maps to snake_case payment_type at finish", () => {
  // Exact DB round-trip: tokenization stores camelCase initUuid/payUuid; finish
  // reads them back and MUST emit snake_case init_uuid/pay_uuid inside payment_type.
  const stored = buildStoredNowSelectedPayment(
    {
      type: "now",
      amount: "3.00",
      currencyCode: "USD",
      isNeedCreditCardData: true,
      isNeedCvc: true,
    },
    { initUuid: U1, payUuid: U2, returnPath: "https://example.com/return" },
  );
  assert.equal(stored.initUuid, U1);
  assert.equal(stored.payUuid, U2);

  const body = buildStartBookingRequest({
    partner: { partnerOrderId: "po-1" },
    language: "en",
    user: { email: "guest@example.com" },
    rooms: [{ guests: [{ firstName: "Ratehawk", lastName: "Test" }] }],
    payment: {
      type: "now",
      amount: stored.amount,
      currencyCode: stored.currencyCode,
      initUuid: stored.initUuid,
      payUuid: stored.payUuid,
      returnPath: stored.returnPath,
    },
  });
  const pt = body.payment_type as Record<string, unknown>;
  assert.equal(pt.init_uuid, U1);
  assert.equal(pt.pay_uuid, U2);
  // Test fails if either identifier is absent from the ETG-required location.
  assert.ok("init_uuid" in pt, "payment_type.init_uuid must be present");
  assert.ok("pay_uuid" in pt, "payment_type.pay_uuid must be present");
});

test("now finish body carries no card data anywhere", () => {
  const body = buildStartBookingRequest({
    partner: { partnerOrderId: "po-1" },
    language: "en",
    user: { email: "guest@example.com" },
    rooms: [{ guests: [{ firstName: "Ratehawk", lastName: "Test" }] }],
    payment: {
      type: "now",
      amount: "3.00",
      currencyCode: "USD",
      initUuid: U1,
      payUuid: U2,
      returnPath: "https://example.com/return",
    },
  });
  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbidden of [
    "cardnumber",
    "card_number",
    "cvc",
    "expiry",
    "card_holder",
    "cardholder",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `finish body must not contain ${forbidden}`);
  }
});

test("buildStartBookingRequest (now) requires a return_path", () => {
  assert.throws(() =>
    buildStartBookingRequest({
      partner: { partnerOrderId: "po-1" },
      language: "en",
      user: { email: "guest@example.com" },
      rooms: [{ guests: [{ firstName: "Ratehawk", lastName: "Test" }] }],
      payment: { type: "now", amount: "100.00", currencyCode: "USD", initUuid: U1, payUuid: U2 },
    }),
  );
});

test("selectNowPaymentType prefers USD then falls back to first now", () => {
  assert.equal(selectNowPaymentType([nowEur, nowUsd])?.currencyCode, "USD");
  assert.equal(selectNowPaymentType([nowEur])?.currencyCode, "EUR");
  assert.equal(selectNowPaymentType([deposit]), null);
});

test("decideStandalonePaymentSelection honours deposit priority + now flag", () => {
  // deposit present -> deposit regardless of now flag
  assert.equal(
    decideStandalonePaymentSelection({ paymentTypes: [deposit, nowUsd], nowEnabled: true }).mode,
    "deposit",
  );
  // only now, flag off -> unsupported
  assert.equal(
    decideStandalonePaymentSelection({ paymentTypes: [nowUsd], nowEnabled: false }).mode,
    "unsupported",
  );
  // only now, flag on -> now
  const now = decideStandalonePaymentSelection({ paymentTypes: [nowUsd], nowEnabled: true });
  assert.equal(now.mode, "now");
  assert.equal(now.selected?.type, "now");
});

test("buildStoredNowSelectedPayment never persists card data", () => {
  const polluted = {
    type: "now",
    amount: "100.00",
    currencyCode: "USD",
    isNeedCreditCardData: true,
    isNeedCvc: true,
    // hostile extra fields that must be dropped
    cardNumber: "4111111111111111",
    cvc: "123",
    card_holder: "X",
  } as unknown as SelectedPaymentType;

  const stored = buildStoredNowSelectedPayment(polluted, {
    initUuid: U1,
    payUuid: U2,
    returnPath: "https://example.com/return",
  });

  assert.deepEqual(Object.keys(stored).sort(), [
    "amount",
    "currencyCode",
    "initUuid",
    "isNeedCreditCardData",
    "isNeedCvc",
    "payUuid",
    "returnPath",
    "type",
  ]);
  assert.equal("cardNumber" in stored, false);
  assert.equal("cvc" in stored, false);
  assert.equal(stored.initUuid, U1);
  assert.equal(stored.payUuid, U2);
});

test("classifyCreditCardToken maps ok->success and errors->failed", () => {
  assert.equal(classifyCreditCardToken({ httpStatus: 200, status: "ok", error: null }).kind, "success");
  assert.equal(
    classifyCreditCardToken({ httpStatus: 200, status: null, error: "invalid_card" }).kind,
    "failed",
  );
  assert.equal(classifyCreditCardToken({ httpStatus: 400, status: null, error: null }).kind, "failed");
});

test("parseThreeDsRedirect extracts a safe ACS redirect", () => {
  const redirect = parseThreeDsRedirect({
    data_3ds: {
      action_url: "https://acs.example.com/auth/start.do",
      method: "POST",
      data: { MD: "md-1", PaReq: "pareq-1", TermUrl: "https://example.com/term" },
    },
  });
  assert.equal(redirect?.actionUrl, "https://acs.example.com/auth/start.do");
  assert.equal(redirect?.method, "post");
  assert.deepEqual(redirect?.fields, {
    MD: "md-1",
    PaReq: "pareq-1",
    TermUrl: "https://example.com/term",
  });
});

test("parseThreeDsRedirect rejects missing block or insecure action_url", () => {
  assert.equal(parseThreeDsRedirect({}), null);
  assert.equal(parseThreeDsRedirect(null), null);
  assert.equal(
    parseThreeDsRedirect({ data_3ds: { action_url: "http://insecure.example.com", data: {} } }),
    null,
  );
});
