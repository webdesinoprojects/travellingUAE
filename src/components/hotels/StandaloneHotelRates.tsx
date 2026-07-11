"use client";

import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { HotelImage } from "@/components/hotels/HotelImage";
import {
  DEFAULT_RATE_FILTER,
  computeRateFacets,
  filterAndSortRates,
  isDefaultRateFilter,
  type RateFilterState,
  type RateSortKey,
} from "@/lib/hotel-rate-filter";
import type { HotelRateDTO } from "@/types/hotels";

type Props = {
  searchId: string;
  hotelId: string;
  rates: HotelRateDTO[];
  /** Presentation-only context (real data). Booking behavior is unchanged. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  roomsCount?: number;
  /** Where the "Change" button navigates (back to results). */
  changeHref?: string;
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

type RoomGroup = {
  key: string;
  title: string;
  rates: HotelRateDTO[];
  primary: HotelRateDTO;
  images: string[];
};

type PhotoModalState = {
  title: string;
  images: string[];
  facts: string[];
  rates: HotelRateDTO[];
};

const SORT_OPTIONS: Array<{ value: RateSortKey; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function StandaloneHotelRates({
  searchId,
  hotelId,
  rates,
  checkIn,
  checkOut,
  guests,
  roomsCount,
  changeHref,
}: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [state, setState] = useState<PrebookState>({ rateId: null, error: null });
  const [filter, setFilter] = useState<RateFilterState>(DEFAULT_RATE_FILTER);
  const [photoModal, setPhotoModal] = useState<PhotoModalState | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const facets = useMemo(() => computeRateFacets(rates), [rates]);
  const visibleRates = useMemo(() => filterAndSortRates(rates, filter), [rates, filter]);
  const roomGroups = useMemo(() => groupRatesByRoom(visibleRates), [visibleRates]);

  const nights = countNights(checkIn, checkOut);

  // Booking behavior: unchanged. The selected quote id is still the only rate
  // identifier passed to prebook, and the server still reads the stored hash.
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

      window.location.assign(payload.data.checkoutUrl);
    } catch {
      setState({
        rateId: null,
        error: "A connection error occurred. Please check your internet and try again.",
      });
    }
  }

  const patch = (next: Partial<RateFilterState>) => setFilter((f) => ({ ...f, ...next }));

  function toggleListFacet(field: "meals" | "beds" | "paymentTypes" | "smoking", value: string) {
    setFilter((current) => {
      const values = current[field];
      return {
        ...current,
        [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  }

  function openPhotos(group: RoomGroup) {
    setPhotoIndex(0);
    setPhotoModal({
      title: group.title,
      images: group.images,
      facts: buildRoomFacts(group.primary),
      rates: group.rates,
    });
  }

  return (
    <div className="mt-5 grid gap-4">
      {checkIn && checkOut ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-muted px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-brand-navy/75 dark:text-white/75">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-brand-blue" aria-hidden="true" />
              {checkIn} to {checkOut}
              {nights ? <span className="text-brand-navy/45 dark:text-white/45">- {nights} night{nights === 1 ? "" : "s"}</span> : null}
            </span>
            {guests ? (
              <span className="inline-flex items-center gap-2">
                <Users className="size-4 text-brand-blue" aria-hidden="true" />
                {guests} guests{roomsCount ? `, ${roomsCount} rooms` : ""}
              </span>
            ) : null}
          </div>
          {changeHref ? (
            <Link
              href={changeHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-border-soft bg-white px-3 text-sm font-black text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white"
            >
              Change
            </Link>
          ) : null}
        </div>
      ) : null}

      {rates.length > 1 ? (
        <div className="grid gap-2 rounded-lg border border-border-soft bg-surface px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-border-soft bg-white px-2.5 dark:bg-surface-muted">
              <Search className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
              <input
                value={filter.query}
                onChange={(event) => patch({ query: event.target.value })}
                placeholder="Search rooms"
                aria-label="Search rooms"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-brand-navy/40"
              />
            </div>

            <label className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-2.5 text-sm font-bold dark:bg-surface-muted">
              <span className="text-brand-brown">Sort</span>
              <select
                value={filter.sort}
                onChange={(event) => patch({ sort: event.target.value as RateSortKey })}
                aria-label="Sort rooms"
                className="bg-transparent font-bold outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-sm font-black text-brand-navy hover:bg-[#fffaf2] disabled:opacity-60 dark:bg-white/10 dark:text-white"
            >
              <RotateCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Reload rates
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {facets.meals.map((meal) => (
              <FacetButton
                key={`meal-${meal.value}`}
                active={filter.meals.includes(meal.value)}
                label={meal.value}
                count={meal.count}
                onClick={() => toggleListFacet("meals", meal.value)}
              />
            ))}
            {facets.beds.map((bed) => (
              <FacetButton
                key={`bed-${bed.value}`}
                active={filter.beds.includes(bed.value)}
                label={bed.value}
                count={bed.count}
                onClick={() => toggleListFacet("beds", bed.value)}
              />
            ))}
            {facets.paymentTypes.map((payment) => (
              <FacetButton
                key={`payment-${payment.value}`}
                active={filter.paymentTypes.includes(payment.value)}
                label={formatPaymentType(payment.value)}
                count={payment.count}
                onClick={() => toggleListFacet("paymentTypes", payment.value)}
              />
            ))}
            {facets.smoking.map((smoking) => (
              <FacetButton
                key={`smoking-${smoking.value}`}
                active={filter.smoking.includes(smoking.value)}
                label={smoking.value}
                count={smoking.count}
                onClick={() => toggleListFacet("smoking", smoking.value)}
              />
            ))}
            {facets.hasCancellation ? (
              <button
                type="button"
                onClick={() => patch({ freeCancellationOnly: !filter.freeCancellationOnly })}
                aria-pressed={filter.freeCancellationOnly}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition ${
                  filter.freeCancellationOnly
                    ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-border-soft bg-white text-brand-navy/75 hover:bg-[#fffaf2] dark:bg-surface-muted dark:text-white/75"
                }`}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Free cancellation
              </button>
            ) : null}
            {!isDefaultRateFilter(filter) ? (
              <button type="button" onClick={() => setFilter(DEFAULT_RATE_FILTER)} className="text-sm font-black text-brand-blue">
                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{state.error}</p>
        </div>
      ) : null}

      {roomGroups.map((group) => (
        <article key={group.key} className="overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="border-b border-border-soft bg-surface-muted p-3 lg:border-b-0 lg:border-r">
              <button
                type="button"
                onClick={() => openPhotos(group)}
                className="group relative block w-full overflow-hidden rounded-lg border border-border-soft bg-white text-left transition hover:border-brand-blue/40 dark:bg-black/10"
                aria-label={`Open details for ${group.title}`}
              >
                <HotelImage
                  src={group.images[0] ?? null}
                  alt={group.images.length > 0 ? group.title : "Room photo unavailable"}
                  className="aspect-[4/3] w-full transition group-hover:scale-[1.02]"
                />
                {group.images.length > 0 ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-brand-navy/85 px-2 py-1 text-xs font-black text-white">
                    <Camera className="size-3.5" aria-hidden="true" />
                    {group.images.length} photos
                  </span>
                ) : (
                  <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-black text-brand-navy shadow-sm">
                    No room photos returned
                  </span>
                )}
              </button>
              <div className="mt-3 grid gap-1.5 text-xs font-bold text-brand-navy/65 dark:text-white/65">
                {buildRoomFacts(group.primary).map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </div>
            </div>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-start gap-2 text-xl font-black">
                    <BedDouble className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden="true" />
                    <span>{group.title}</span>
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {buildRoomChips(group.primary).map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded-md border border-border-soft bg-surface-muted px-2 py-1 text-xs font-bold text-brand-navy/75 dark:text-white/75"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                {group.primary.allotment ? (
                  <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-200">
                    {group.primary.allotment} rooms left
                  </span>
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-border-soft">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-[0.08em] text-brand-brown">
                    <tr>
                      <th className="px-3 py-2 font-black">Room</th>
                      <th className="px-3 py-2 font-black">Meals</th>
                      <th className="px-3 py-2 font-black">Cancellation</th>
                      <th className="px-3 py-2 font-black">Net price</th>
                      <th className="px-3 py-2 font-black">Payment type</th>
                      <th className="px-3 py-2 text-right font-black">CTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {group.rates.map((rate) => {
                      const isLoading = state.rateId === rate.rateId;
                      return (
                        <tr key={rate.rateId} className="align-top">
                          <td className="px-3 py-3">
                            <p className="font-black">{rate.roomName ?? group.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                              {rate.smokingLabel ? <span>{rate.smokingLabel}</span> : null}
                              {rate.hasBathroom ? <span>Bathroom</span> : null}
                              {rate.capacity ? <span>{rate.capacity} guests</span> : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 font-bold">{rate.boardBasis ?? "Room only"}</td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-brand-navy/80 dark:text-white/80">{formatCancellation(rate)}</span>
                            {rate.cancellationPolicyCount > 0 ? (
                              <span className="mt-1 block text-xs font-semibold text-brand-navy/50 dark:text-white/50">
                                {rate.cancellationPolicyCount} policy window{rate.cancellationPolicyCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-lg font-black">
                              {rate.currency} {rate.priceAmount.toLocaleString("en")}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-xs font-black text-brand-navy/75 dark:text-white/75">
                              <CreditCard className="size-3.5" aria-hidden="true" />
                              {formatPaymentType(rate.paymentType)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => selectRate(rate.rateId)}
                              disabled={Boolean(state.rateId)}
                              className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-55 dark:bg-brand-sand dark:text-brand-navy"
                            >
                              {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                              {isLoading ? "Confirming" : "Choose"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </article>
      ))}

      {rates.length === 0 ? (
        <div className="rounded-lg border border-border-soft bg-surface p-6">
          This hotel no longer has a room matching your search.
        </div>
      ) : visibleRates.length === 0 ? (
        <div className="rounded-lg border border-border-soft bg-surface p-6 text-center">
          <p className="font-black">No rooms match these filters</p>
          <button type="button" onClick={() => setFilter(DEFAULT_RATE_FILTER)} className="mt-2 text-sm font-black text-brand-blue">
            Reset filters
          </button>
        </div>
      ) : null}

      {photoModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4">
          <div className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-surface shadow-2xl lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative min-h-[320px] bg-black">
              {photoModal.images.length > 0 ? (
                <>
                  <HotelImage
                    src={photoModal.images[photoIndex] ?? null}
                    alt={`${photoModal.title} photo ${photoIndex + 1}`}
                    className="h-full min-h-[320px] w-full"
                  />
                  {photoModal.images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((index) => (index === 0 ? photoModal.images.length - 1 : index - 1))}
                        className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy"
                        aria-label="Previous room photo"
                      >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((index) => (index + 1) % photoModal.images.length)}
                        className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy"
                        aria-label="Next room photo"
                      >
                        <ChevronRight className="size-5" aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                  <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs font-black text-white">
                    {photoIndex + 1} / {photoModal.images.length}
                  </span>
                </>
              ) : (
                <div className="grid h-full min-h-[320px] place-items-center bg-surface-muted p-8 text-center text-brand-navy dark:bg-black/30 dark:text-white">
                  <div>
                    <Camera className="mx-auto size-10 text-brand-blue/45" aria-hidden="true" />
                    <p className="mt-3 text-lg font-black">No room photos returned</p>
                    <p className="mt-1 text-sm font-semibold text-brand-navy/55 dark:text-white/55">
                      RateHawk returned room facts for this option, but no room-level image URLs in the hotelpage response.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <aside className="overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-black">{photoModal.title}</h3>
                <button
                  type="button"
                  onClick={() => setPhotoModal(null)}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-soft"
                  aria-label="Close room photos"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {photoModal.facts.length > 0 ? (
                <dl className="mt-5 grid gap-3">
                  {photoModal.facts.map((fact) => (
                    <div key={fact} className="rounded-lg border border-border-soft bg-surface-muted p-3">
                      <dt className="text-xs font-black uppercase tracking-[0.08em] text-brand-brown">Room fact</dt>
                      <dd className="mt-1 text-sm font-bold">{fact}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="mt-5 border-t border-border-soft pt-4">
                <h4 className="text-xs font-black uppercase tracking-[0.08em] text-brand-brown">Available rates</h4>
                <div className="mt-3 grid gap-2">
                  {photoModal.rates.map((rate) => (
                    <div key={rate.rateId} className="rounded-lg border border-border-soft bg-surface-muted p-3">
                      <p className="text-sm font-black">{rate.boardBasis ?? "Room only"}</p>
                      <p className="mt-1 text-lg font-black">
                        {rate.currency} {rate.priceAmount.toLocaleString("en")}
                      </p>
                      <div className="mt-1 grid gap-0.5 text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                        <span>{formatCancellation(rate)}</span>
                        <span>{formatPaymentType(rate.paymentType)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacetButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition ${
        active
          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
          : "border-border-soft bg-white text-brand-navy/75 hover:bg-[#fffaf2] dark:bg-surface-muted dark:text-white/75"
      }`}
    >
      {label}
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}

function groupRatesByRoom(rates: HotelRateDTO[]): RoomGroup[] {
  const groups = new Map<string, RoomGroup>();

  for (const rate of rates) {
    const title = rate.roomGroupName ?? rate.roomName ?? "Hotel room";
    const key = `${title.toLowerCase()}|${rate.roomImages[0] ?? "no-image"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rates.push(rate);
      existing.images = mergeImages(existing.images, rate.roomImages);
      continue;
    }
    groups.set(key, {
      key,
      title,
      rates: [rate],
      primary: rate,
      images: [...rate.roomImages],
    });
  }

  return [...groups.values()];
}

function mergeImages(left: string[], right: string[]) {
  const seen = new Set(left);
  const merged = [...left];
  for (const image of right) {
    if (seen.has(image)) continue;
    seen.add(image);
    merged.push(image);
  }
  return merged;
}

function buildRoomFacts(rate: HotelRateDTO): string[] {
  const facts = [
    rate.bedType,
    ...rate.beds,
    rate.roomSizeSqm ? `${rate.roomSizeSqm} sqm` : null,
    rate.capacity ? `Sleeps ${rate.capacity}` : null,
    rate.smokingLabel,
    rate.hasBathroom ? "Bathroom" : null,
  ];
  return uniqueStrings(facts);
}

function buildRoomChips(rate: HotelRateDTO): string[] {
  return uniqueStrings([
    rate.bedType,
    ...rate.beds,
    rate.roomSizeSqm ? `${rate.roomSizeSqm} sqm` : null,
    rate.capacity ? `${rate.capacity} guests` : null,
    rate.smokingLabel,
    rate.hasBathroom ? "Bathroom" : null,
    ...rate.amenities.slice(0, 6),
  ]);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function formatPaymentType(value: string | null | undefined) {
  switch (value) {
    case "now":
      return "Pay now";
    case "hotel":
      return "Hotel payment";
    case "deposit":
      return "Deposit";
    case "card":
      return "Card";
    default:
      return value ? value.replace(/[_-]+/g, " ") : "Not returned";
  }
}

function formatCancellation(rate: HotelRateDTO) {
  if (rate.cancellationFreeBefore) {
    return `Free until ${formatDateTime(rate.cancellationFreeBefore)}`;
  }
  if (rate.cancellationPolicyCount > 0) return "Policy returned";
  return "Not returned yet";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function countNights(checkIn?: string, checkOut?: string): number | null {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
}
