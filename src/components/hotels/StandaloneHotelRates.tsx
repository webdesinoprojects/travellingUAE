"use client";

import { AlertCircle, BedDouble, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { HotelRateDTO } from "@/types/hotels";

type Props = {
  searchId: string;
  hotelId: string;
  rates: HotelRateDTO[];
};

type PrebookState = {
  rateId: string | null;
  error: string | null;
};

type PrebookResponse = {
  ok: boolean;
  message?: string;
  data?: {
    checkoutUrl?: string;
    priceChanged?: boolean;
    newPrice?: { amount: number; currency: string };
  };
};

export function StandaloneHotelRates({ searchId, hotelId, rates }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PrebookState>({ rateId: null, error: null });

  async function selectRate(rateId: string) {
    setState({ rateId, error: null });

    try {
      const response = await fetch(`/api/public/hotels/${encodeURIComponent(hotelId)}/prebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ searchId, rateId }),
      });
      const payload = (await response.json().catch(() => null)) as PrebookResponse | null;

      if (!response.ok || !payload?.ok || !payload.data?.checkoutUrl) {
        setState({
          rateId: null,
          error:
            payload?.message ??
            "This room could not be confirmed. Please choose another rate or try again.",
        });
        return;
      }

      router.push(payload.data.checkoutUrl);
    } catch {
      setState({
        rateId: null,
        error: "A connection error occurred. Please check your internet and try again.",
      });
    }
  }

  return (
    <div className="mt-5 grid gap-4">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{state.error}</p>
        </div>
      ) : null}

      {rates.map((rate) => {
        const isLoading = state.rateId === rate.rateId;
        return (
          <article
            key={rate.rateId}
            className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black">
                <BedDouble className="size-5 text-brand-blue" aria-hidden="true" />
                {rate.roomName ?? "Hotel room"}
              </h3>
              <p className="mt-2 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
                {rate.boardBasis ?? "Room only"}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <p className="text-2xl font-black">
                {rate.currency} {rate.priceAmount.toLocaleString("en")}
              </p>
              <button
                type="button"
                onClick={() => selectRate(rate.rateId)}
                disabled={Boolean(state.rateId)}
                className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-55 dark:bg-brand-sand dark:text-brand-navy"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isLoading ? "Confirming" : "Select / Book"}
              </button>
            </div>
          </article>
        );
      })}

      {rates.length === 0 ? (
        <div className="rounded-lg border border-border-soft bg-surface p-6">
          This hotel no longer has a room matching your search.
        </div>
      ) : null}
    </div>
  );
}
