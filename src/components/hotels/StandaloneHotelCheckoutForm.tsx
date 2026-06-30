"use client";

import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
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
type PayState = "idle" | "redirecting" | "error";

type StripeResponse = {
  ok: boolean;
  message?: string;
  data?: { url?: string };
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

export function StandaloneHotelCheckoutForm({ summary }: Props) {
  const [guestRooms, setGuestRooms] = useState<GuestFormRoom[]>(() =>
    createGuestRooms(summary.rooms),
  );
  const [payState, setPayState] = useState<PayState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const paymentLabel = useMemo(() => {
    if (summary.payment.mode !== "deposit") return null;
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (summary.payment.mode !== "deposit") return;

    setPayState("redirecting");
    setErrorMessage(null);

    const data = new FormData(form);
    const body = {
      firstName: data.get("firstName"),
      lastName: data.get("lastName"),
      email: data.get("email"),
      phone: data.get("phone"),
      comment: data.get("comment"),
      guestRooms,
    };

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
      const payload = (await response.json().catch(() => null)) as StripeResponse | null;

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
        <label className="grid gap-1.5">
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
                <div key={guestIndex} className="grid gap-3 md:grid-cols-[1fr_1fr_180px]">
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
                  <label className="grid gap-1.5">
                    <span className="text-sm font-extrabold text-brand-navy dark:text-white">
                      Gender
                    </span>
                    <select
                      value={guest.gender}
                      required={summary.isGenderSpecificationRequired}
                      onChange={(event) =>
                        updateGuest(roomIndex, guestIndex, "gender", event.target.value)
                      }
                      className="h-11 rounded-lg border border-border-soft bg-surface px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue disabled:opacity-60 dark:bg-black dark:text-white"
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

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={summary.payment.mode !== "deposit" || payState === "redirecting"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-55 dark:bg-brand-sand dark:text-brand-navy"
      >
        {payState === "redirecting" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        {payState === "redirecting"
          ? "Opening secure payment"
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
  required = false,
  value,
  onChange,
}: {
  name?: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
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
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-11 rounded-lg border border-border-soft bg-surface px-3.5 text-sm text-brand-navy outline-none ring-brand-blue/30 transition focus:border-brand-blue focus:ring-2 dark:bg-white/[0.05] dark:text-white dark:ring-brand-sand/30 dark:focus:border-brand-sand"
      />
    </label>
  );
}
