"use client";

import { AlertCircle, CreditCard, Loader2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import type { StandaloneHotelCheckoutSummaryDTO } from "@/types/hotels";
import type { CheckoutGuestGender, CheckoutGuestRoom } from "@/types/itinerary";

type Props = {
  summary: StandaloneHotelCheckoutSummaryDTO;
};

type GuestFormGender = "" | CheckoutGuestGender;
type GuestFormGuest = {
  kind: "adult" | "child";
  age?: number;
  firstName: string;
  lastName: string;
  gender: GuestFormGender;
};
type GuestFormRoom = { guests: GuestFormGuest[] };
type PayState = "idle" | "redirecting" | "processing" | "error";

type CardFields = {
  cardHolder: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
};

type ApiResponse<T> = {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
};

type ThreeDsRedirect = {
  actionUrl: string;
  method: "get" | "post";
  fields: Record<string, string>;
};

type FinishData = {
  status: "processing" | "confirmed" | "failed" | "3ds";
  threeDs: ThreeDsRedirect | null;
  successUrl: string;
};

const EMPTY_CARD: CardFields = {
  cardHolder: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
  cvc: "",
};

function createGuestRooms(rooms: CheckoutGuestRoom[]): GuestFormRoom[] {
  return rooms.map((room) => ({
    guests: room.guests.map((guest) => ({
      kind: guest.kind,
      ...(guest.age != null ? { age: guest.age } : {}),
      firstName: "",
      lastName: "",
      gender: "",
    })),
  }));
}

/** Submit the ETG 3-D Secure redirect as a top-level form post/get to the ACS. */
function submitThreeDsRedirect(threeDs: ThreeDsRedirect) {
  const form = document.createElement("form");
  form.method = threeDs.method === "get" ? "GET" : "POST";
  form.action = threeDs.actionUrl;
  for (const [name, value] of Object.entries(threeDs.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function StandaloneHotelCheckoutForm({ summary }: Props) {
  const [guestRooms, setGuestRooms] = useState<GuestFormRoom[]>(() =>
    createGuestRooms(summary.rooms),
  );
  const [card, setCard] = useState<CardFields>(EMPTY_CARD);
  const [payState, setPayState] = useState<PayState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDeposit = summary.payment.mode === "deposit";
  const isNow = summary.payment.mode === "now";
  const needsCard = summary.payment.mode === "now" && summary.payment.isNeedCreditCardData;
  const needsCvc = summary.payment.mode === "now" && summary.payment.isNeedCvc;
  const payable = isDeposit || isNow;

  const paymentLabel = useMemo(() => {
    if (summary.payment.mode === "unsupported") return null;
    return `${summary.payment.currencyCode} ${Number(summary.payment.amount).toLocaleString("en")}`;
  }, [summary.payment]);

  function updateGuest(
    roomIndex: number,
    guestIndex: number,
    field: "firstName" | "lastName" | "gender",
    value: string,
  ) {
    setGuestRooms((current) =>
      current.map((room, rIndex) =>
        rIndex !== roomIndex
          ? room
          : {
              guests: room.guests.map((guest, gIndex) =>
                gIndex !== guestIndex
                  ? guest
                  : { ...guest, [field]: value as GuestFormGender },
              ),
            },
      ),
    );
  }

  function updateCard(field: keyof CardFields, value: string) {
    setCard((current) => ({ ...current, [field]: value }));
  }

  function readContact(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      firstName: data.get("firstName"),
      lastName: data.get("lastName"),
      email: data.get("email"),
      phone: data.get("phone"),
      comment: data.get("comment"),
    };
  }

  async function handleDepositSubmit(form: HTMLFormElement) {
    setPayState("redirecting");
    setErrorMessage(null);

    const body = { ...readContact(form), guestRooms };
    try {
      const response = await fetch(
        `/api/public/hotels/checkout/${encodeURIComponent(summary.checkoutId)}/stripe-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiResponse<{ url?: string }> | null;

      if (!response.ok || !payload?.ok || !payload.data?.url) {
        setPayState("error");
        setErrorMessage(
          payload?.message ??
            "Payment could not be started. Please review the details and try again.",
        );
        return;
      }

      window.location.href = payload.data.url;
    } catch {
      setPayState("error");
      setErrorMessage("A connection error occurred. Please check your internet and try again.");
    }
  }

  async function handleNowSubmit(form: HTMLFormElement) {
    setPayState("processing");
    setErrorMessage(null);

    const contact = readContact(form);

    try {
      // Step 1: tokenize the card (only when ETG requires card data).
      if (needsCard) {
        const tokenizeBody = {
          ...contact,
          guestRooms,
          cardHolder: card.cardHolder,
          cardNumber: card.cardNumber,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ...(needsCvc ? { cvc: card.cvc } : {}),
        };
        const tokenizeResponse = await fetch(
          `/api/public/hotels/checkout/${encodeURIComponent(summary.checkoutId)}/etg-now-tokenize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(tokenizeBody),
          },
        );
        const tokenizePayload = (await tokenizeResponse
          .json()
          .catch(() => null)) as ApiResponse<{ ok: true }> | null;

        if (!tokenizeResponse.ok || !tokenizePayload?.ok) {
          setPayState("error");
          setErrorMessage(
            tokenizePayload?.message ??
              "We could not verify your card. Please check the details and try again.",
          );
          return;
        }
      }

      // Step 2: start the booking (+ first 3DS/status check).
      const finishResponse = await fetch(
        `/api/public/hotels/checkout/${encodeURIComponent(summary.checkoutId)}/etg-finish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({}),
        },
      );
      const finishPayload = (await finishResponse
        .json()
        .catch(() => null)) as ApiResponse<FinishData> | null;

      if (!finishResponse.ok || !finishPayload?.ok || !finishPayload.data) {
        setPayState("error");
        setErrorMessage(
          finishPayload?.message ?? "We could not complete your booking. Please try again.",
        );
        return;
      }

      const data = finishPayload.data;
      if (data.threeDs) {
        // Hand off to the issuer's 3-D Secure page; it returns to successUrl.
        submitThreeDsRedirect(data.threeDs);
        return;
      }

      window.location.href = data.successUrl;
    } catch {
      setPayState("error");
      setErrorMessage("A connection error occurred. Please check your internet and try again.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (payState === "redirecting" || payState === "processing") return;

    if (isDeposit) {
      await handleDepositSubmit(form);
    } else if (isNow) {
      await handleNowSubmit(form);
    }
  }

  const busy = payState === "redirecting" || payState === "processing";

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {summary.priceChanged ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-semibold text-amber-900 dark:text-amber-100">
          The provider updated the room price from{" "}
          {summary.originalPrice?.currency} {summary.originalPrice?.amount.toLocaleString("en")} to{" "}
          {summary.price.currency} {summary.price.amount.toLocaleString("en")}.
        </div>
      ) : null}

      {summary.payment.mode === "unsupported" ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-5 text-sm text-amber-950 dark:text-amber-100">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-black">Online card payment is unavailable</h2>
            <p className="mt-2 leading-6">{summary.payment.reason}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-xl font-black">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="firstName" label="First name" autoComplete="given-name" required />
          <TextInput name="lastName" label="Last name" autoComplete="family-name" required />
          <TextInput name="email" label="Email" type="email" autoComplete="email" required />
          <TextInput name="phone" label="Phone / WhatsApp" type="tel" autoComplete="tel" required />
        </div>
        <label className="grid gap-1.5 min-w-0">
          <span className="text-sm font-extrabold text-brand-navy dark:text-white">
            Comment
          </span>
          <textarea
            name="comment"
            rows={4}
            maxLength={2000}
            className="rounded-lg border border-border-soft bg-surface px-3.5 py-3 text-sm text-brand-navy outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:ring-brand-sand/30 dark:focus:border-brand-sand"
          />
        </label>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-black">Guest names</h2>
        {guestRooms.map((room, roomIndex) => (
          <div
            key={roomIndex}
            className="rounded-lg border border-border-soft bg-surface-muted p-4"
          >
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-brand-navy/60 dark:text-white/60">
              Room {roomIndex + 1}
            </h3>
            <div className="mt-4 grid gap-4">
              {room.guests.map((guest, guestIndex) => (
                <div
                  key={guestIndex}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,11rem)]"
                >
                  <TextInput
                    label={`${guest.kind === "child" ? "Child" : "Adult"} ${guestIndex + 1} first name`}
                    value={guest.firstName}
                    onChange={(value) => updateGuest(roomIndex, guestIndex, "firstName", value)}
                    required
                  />
                  <TextInput
                    label="Last name"
                    value={guest.lastName}
                    onChange={(value) => updateGuest(roomIndex, guestIndex, "lastName", value)}
                    required
                  />
                  <label className="grid gap-1.5 min-w-0">
                    <span className="text-sm font-extrabold text-brand-navy dark:text-white">
                      Gender
                    </span>
                    <select
                      value={guest.gender}
                      required={summary.isGenderSpecificationRequired}
                      onChange={(event) =>
                        updateGuest(roomIndex, guestIndex, "gender", event.target.value)
                      }
                      className="h-11 w-full min-w-0 rounded-lg border border-border-soft bg-surface px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue disabled:opacity-60 dark:bg-black dark:text-white"
                    >
                      <option value="">
                        {summary.isGenderSpecificationRequired ? "Select" : "Not required"}
                      </option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {guest.kind === "child" && guest.age != null ? (
                      <span className="text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                        Age {guest.age}
                      </span>
                    ) : null}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {needsCard ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-black">Card details</h2>
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold leading-6">
              ETG test booking/card flow. Do not use real card data. Use only the official ETG
              test card from the ETG Best Practices documentation.
            </p>
          </div>
          <TextInput
            label="Cardholder name"
            value={card.cardHolder}
            onChange={(value) => updateCard("cardHolder", value)}
            autoComplete="off"
            required
          />
          <TextInput
            label="Card number"
            value={card.cardNumber}
            onChange={(value) => updateCard("cardNumber", value)}
            autoComplete="off"
            inputMode="numeric"
            required
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <TextInput
              label="Expiry month (MM)"
              value={card.expiryMonth}
              onChange={(value) => updateCard("expiryMonth", value)}
              autoComplete="off"
              inputMode="numeric"
              placeholder="01"
              required
            />
            <TextInput
              label="Expiry year (YY)"
              value={card.expiryYear}
              onChange={(value) => updateCard("expiryYear", value)}
              autoComplete="off"
              inputMode="numeric"
              placeholder="30"
              required
            />
            {needsCvc ? (
              <TextInput
                label="CVC"
                value={card.cvc}
                onChange={(value) => updateCard("cvc", value)}
                autoComplete="off"
                inputMode="numeric"
                required
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!payable || busy}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-55 dark:bg-brand-sand dark:text-brand-navy"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        {busy
          ? isNow
            ? "Confirming your booking"
            : "Opening secure payment"
          : paymentLabel
            ? `Pay ${paymentLabel}`
            : "Payment unavailable"}
      </button>
    </form>
  );
}

function TextInput({
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  required = false,
  value,
  onChange,
}: {
  name?: string;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel";
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 min-w-0">
      <span className="text-sm font-extrabold text-brand-navy dark:text-white">
        {label}
        {required ? <span className="ml-1 text-brand-blue dark:text-brand-sand">*</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-11 w-full min-w-0 rounded-lg border border-border-soft bg-surface px-3.5 text-sm text-brand-navy outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:ring-brand-sand/30 dark:focus:border-brand-sand"
      />
    </label>
  );
}
