export type EsimActivationInput = {
  status: string;
  activationCode: string | null;
  qrPayload: string | null;
  apn: string | null;
  simId: string | null;
  providerOrderId?: string | null;
};

export type CustomerEsimDeliveryModel = {
  isReady: boolean;
  qrPayload: string | null;
  manualActivationCode: string | null;
  apn: string | null;
  simId: string | null;
  providerOrderId: string | null;
};

export function isLpaActivationCode(value: string | null | undefined): boolean {
  return normalizeText(value).toUpperCase().startsWith("LPA:");
}

export function resolveEsimQrPayload(input: {
  activationCode: string | null;
  qrPayload: string | null;
}): string | null {
  const activationCode = normalizeText(input.activationCode);
  if (isLpaActivationCode(activationCode)) {
    return activationCode;
  }

  const qrPayload = normalizeText(input.qrPayload);
  return qrPayload || null;
}

export function buildCustomerEsimDeliveryModel(
  input: EsimActivationInput,
): CustomerEsimDeliveryModel {
  const manualActivationCode = normalizeText(input.activationCode) || null;
  const qrPayload = resolveEsimQrPayload(input);
  const isReady =
    input.status === "fulfilled" && Boolean(manualActivationCode || qrPayload);

  if (!isReady) {
    return {
      isReady: false,
      qrPayload: null,
      manualActivationCode: null,
      apn: null,
      simId: null,
      providerOrderId: null,
    };
  }

  return {
    isReady: true,
    qrPayload,
    manualActivationCode,
    apn: normalizeText(input.apn) || null,
    simId: normalizeText(input.simId) || null,
    providerOrderId: normalizeText(input.providerOrderId) || null,
  };
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}
