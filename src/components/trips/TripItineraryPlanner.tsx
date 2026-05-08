"use client";

import {
  ArrowRight,
  BedDouble,
  Car,
  CheckCircle2,
  Hotel,
  Loader2,
  MapPin,
  Plane,
  Search,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type {
  ActivityOptionDTO,
  FlightOptionDTO,
  HotelOptionDTO,
  ItineraryOptionType,
  ItinerarySegmentDTO,
  MoneyDelta,
  SegmentOptionDTO,
  SegmentOptionsDTO,
  TransferOptionDTO,
  TripItineraryDTO,
} from "@/types/itinerary";

type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

type TripItineraryPlannerProps = {
  destinationSlug: string;
  tripSlug: string;
  itinerary: TripItineraryDTO;
  basePrice: string;
};

type OptionPanelState = {
  segment: ItinerarySegmentDTO;
  options: SegmentOptionDTO[];
  query: string;
  sort: string;
  error?: string;
  isLoading: boolean;
  isSelecting: boolean;
};

const OPTION_ERROR =
  "We could not load these options right now. Please try again.";

const segmentIconMap: Record<ItinerarySegmentDTO["type"], LucideIcon> = {
  flight: Plane,
  hotel: BedDouble,
  transfer: Car,
  activity: Sparkles,
  stay: BedDouble,
  note: MapPin,
};

export function TripItineraryPlanner({
  destinationSlug,
  tripSlug,
  itinerary,
  basePrice,
}: TripItineraryPlannerProps) {
  const [segments, setSegments] = useState(itinerary.segments);
  const [totalDelta, setTotalDelta] = useState<MoneyDelta>(() =>
    calculateInitialDelta(itinerary.segments, itinerary.trip.currency),
  );
  const [panel, setPanel] = useState<OptionPanelState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const summary = useMemo(() => buildTimelineSummary(segments), [segments]);

  async function openOptions(segment: ItinerarySegmentDTO) {
    if (!isOptionType(segment.type)) {
      return;
    }

    setNotice(null);
    setPanel({
      segment,
      options: [],
      query: "",
      sort: "price",
      isLoading: true,
      isSelecting: false,
    });

    await loadOptions(segment, { query: "", sort: "price" });
  }

  async function loadOptions(
    segment: ItinerarySegmentDTO,
    {
      query,
      sort,
    }: {
      query: string;
      sort: string;
    },
  ) {
    if (!isOptionType(segment.type)) {
      return;
    }

    setPanel((current) =>
      current && current.segment.id === segment.id
        ? { ...current, isLoading: true, error: undefined, query, sort }
        : current,
    );

    try {
      const searchParams = new URLSearchParams({
        segmentId: segment.id,
        type: segment.type,
        sort,
      });

      if (query.trim()) {
        if (segment.type === "hotel") {
          searchParams.set("q", query.trim());
        } else if (segment.type === "flight") {
          searchParams.set("airline", query.trim().toUpperCase());
        } else if (segment.type === "transfer") {
          searchParams.set("vehicle", query.trim().toLowerCase());
        } else {
          searchParams.set("category", query.trim());
        }
      }

      const data = await fetchJson<SegmentOptionsDTO>(
        `/api/public/trips/${destinationSlug}/${tripSlug}/options?${searchParams.toString()}`,
      );

      setPanel((current) =>
        current && current.segment.id === segment.id
          ? {
              ...current,
              options: data.options,
              query,
              sort,
              isLoading: false,
              error: undefined,
            }
          : current,
      );
    } catch {
      setPanel((current) =>
        current && current.segment.id === segment.id
          ? {
              ...current,
              isLoading: false,
              error: OPTION_ERROR,
            }
          : current,
      );
    }
  }

  async function selectOption(option: SegmentOptionDTO) {
    if (!panel || !isOptionType(panel.segment.type)) {
      return;
    }

    setPanel((current) =>
      current
        ? {
            ...current,
            isSelecting: true,
            error: undefined,
          }
        : current,
    );

    try {
      const result = await fetchJson<{
        selected: SegmentOptionDTO;
        totalDelta: MoneyDelta;
        expiresAt: string;
      }>(`/api/public/trips/${destinationSlug}/${tripSlug}/selection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          segmentId: panel.segment.id,
          optionType: panel.segment.type,
          optionId: option.id,
          travelDate: itinerary.trip.startDate,
          travelersCount: 2,
        }),
      });

      setSegments((current) =>
        current.map((segment) =>
          segment.id === panel.segment.id
            ? { ...segment, selectedOption: result.selected }
            : segment,
        ),
      );
      setTotalDelta(result.totalDelta);
      setNotice("Your package option has been updated.");
      setPanel(null);
    } catch {
      setPanel((current) =>
        current
          ? {
              ...current,
              isSelecting: false,
              error:
                "We could not save that option. Please choose another option or try again.",
            }
          : current,
      );
    }
  }

  return (
    <section id="trip-builder" className="mt-12 scroll-mt-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            <Sparkles aria-hidden="true" className="size-4" />
            Package Builder
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-navy dark:text-white">
            Review your itinerary options
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-navy/68 dark:text-white/68">
            Flights, hotels, transfers and activities are loaded from the
            backend itinerary model. Changeable items update a secure
            server-side selection session.
          </p>
        </div>
        {notice ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-sm font-bold text-brand-green dark:text-brand-sand">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {notice}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          {segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onChange={() => openOptions(segment)}
            />
          ))}
        </div>

        <aside className="modern-card h-fit rounded-lg p-4 xl:sticky xl:top-28">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Trip timeline
          </p>
          <div className="mt-4 border-l border-border-soft">
            {summary.map((item, index) => (
              <div key={item.segmentId} className="relative pb-5 pl-5 last:pb-0">
                <span className="absolute -left-[7px] top-1 grid size-3.5 place-items-center rounded-full bg-brand-blue text-white dark:bg-brand-sand dark:text-brand-navy">
                  <span className="text-[9px] font-black">{index + 1}</span>
                </span>
                <p className="text-sm font-extrabold text-brand-navy dark:text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-brand-navy/58 dark:text-white/58">
                  {item.dateLabel ?? "Day 1"}
                  {item.selectedLabel ? ` | ${item.selectedLabel}` : ""}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-border-soft bg-surface-muted/60 p-4 dark:bg-white/[0.04]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
              Starting package
            </p>
            <p className="mt-1 text-2xl font-black text-brand-navy dark:text-white">
              {basePrice}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
              Selected changes
            </p>
            <p className="mt-1 text-2xl font-black text-brand-blue dark:text-brand-sand">
              {totalDelta.label}
            </p>
          </div>
        </aside>
      </div>

      <OptionPanel
        panel={panel}
        onClose={() => setPanel(null)}
        onDraftChange={(updates) =>
          setPanel((current) => (current ? { ...current, ...updates } : current))
        }
        onReload={(query, sort) => {
          if (panel) {
            void loadOptions(panel.segment, { query, sort });
          }
        }}
        onSelect={(option) => {
          void selectOption(option);
        }}
      />
    </section>
  );
}

function SegmentCard({
  segment,
  onChange,
}: {
  segment: ItinerarySegmentDTO;
  onChange: () => void;
}) {
  const Icon = segmentIconMap[segment.type];

  return (
    <article className="modern-card overflow-hidden rounded-lg">
      <div className="flex flex-col gap-4 border-b border-border-soft bg-surface-muted/45 p-4 dark:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-blue text-white dark:bg-brand-sand dark:text-brand-navy">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue/70 dark:text-brand-sand">
              {segment.dateLabel ?? "Day 1"}
            </p>
            <h3 className="mt-1 truncate text-lg font-extrabold text-brand-navy dark:text-white">
              {segment.title}
            </h3>
          </div>
        </div>

        {segment.isChangeable && isOptionType(segment.type) ? (
          <button
            type="button"
            onClick={onChange}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy"
          >
            Change Option
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="p-4">
        {segment.description ? (
          <p className="mb-4 text-sm leading-6 text-brand-navy/68 dark:text-white/68">
            {segment.description}
          </p>
        ) : null}
        {segment.selectedOption ? (
          <SelectedOption option={segment.selectedOption} />
        ) : (
          <p className="rounded-lg border border-border-soft bg-surface-muted/50 p-4 text-sm font-semibold text-brand-navy/62 dark:bg-white/[0.04] dark:text-white/62">
            No default option is selected for this itinerary item yet.
          </p>
        )}
      </div>
    </article>
  );
}

function SelectedOption({ option }: { option: SegmentOptionDTO }) {
  if (option.type === "flight") {
    return <FlightOptionView option={option} compact />;
  }

  if (option.type === "hotel") {
    return <HotelOptionView option={option} compact />;
  }

  if (option.type === "transfer") {
    return <TransferOptionView option={option} compact />;
  }

  return <ActivityOptionView option={option} compact />;
}

function OptionPanel({
  panel,
  onClose,
  onDraftChange,
  onReload,
  onSelect,
}: {
  panel: OptionPanelState | null;
  onClose: () => void;
  onDraftChange: (updates: Pick<OptionPanelState, "query" | "sort">) => void;
  onReload: (query: string, sort: string) => void;
  onSelect: (option: SegmentOptionDTO) => void;
}) {
  if (!panel) {
    return null;
  }

  const queryPlaceholder = getOptionSearchPlaceholder(panel.segment.type);

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close option selector"
        onClick={onClose}
        className="absolute inset-0 bg-black/58 backdrop-blur-sm"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[860px] flex-col overflow-hidden bg-surface text-brand-navy shadow-[-24px_0_80px_rgb(0_0_0/0.28)] dark:bg-black dark:text-white">
        <header className="border-b border-border-soft p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
                Change option
              </p>
              <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
                {panel.segment.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-lg border border-border-soft hover:bg-surface-muted dark:hover:bg-white/[0.08]"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_110px]">
            <label className="flex h-11 items-center rounded-lg border border-border-soft bg-surface-muted/60 px-3 dark:bg-white/[0.04]">
              <Search aria-hidden="true" className="mr-2 size-4 text-brand-blue dark:text-brand-sand" />
              <span className="sr-only">Search options</span>
              <input
                value={panel.query}
                onChange={(event) =>
                  onDraftChange({ query: event.target.value, sort: panel.sort })
                }
                placeholder={queryPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-brand-navy/42 dark:placeholder:text-white/42"
              />
            </label>
            <label className="block">
              <span className="sr-only">Sort options</span>
              <select
                value={panel.sort}
                onChange={(event) =>
                  onDraftChange({ query: panel.query, sort: event.target.value })
                }
                className="h-11 w-full rounded-lg border border-border-soft bg-surface-muted/60 px-3 text-sm font-bold outline-none dark:bg-white/[0.04]"
              >
                <option value="price">Lowest price</option>
                <option value="duration">Shortest time</option>
                <option value="rating">Best rating</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => onReload(panel.query, panel.sort)}
              className="h-11 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy"
            >
              Apply
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {panel.error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">
              {panel.error}
            </div>
          ) : null}

          {panel.isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-lg border border-border-soft bg-surface-muted dark:bg-white/[0.05]"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {panel.options.map((option) => (
                <OptionChoice
                  key={option.id}
                  option={option}
                  disabled={panel.isSelecting}
                  onSelect={() => onSelect(option)}
                />
              ))}
              {panel.options.length === 0 ? (
                <div className="rounded-lg border border-border-soft p-8 text-center">
                  <p className="text-lg font-extrabold">No options found</p>
                  <p className="mt-2 text-sm text-brand-navy/62 dark:text-white/62">
                    Adjust the search or clear filters to see available choices.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function OptionChoice({
  option,
  disabled,
  onSelect,
}: {
  option: SegmentOptionDTO;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <article className="rounded-lg border border-border-soft bg-surface p-4 shadow-sm dark:bg-white/[0.035]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-center">
        <SelectedOption option={option} />
        <div className="grid gap-3">
          <div className="rounded-lg bg-brand-navy p-4 text-white dark:bg-brand-sand dark:text-brand-navy">
            <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
              Price change
            </p>
            <p className="mt-1 text-2xl font-black">{option.priceDelta.label}</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-blue text-sm font-extrabold text-white transition hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-55 dark:bg-brand-sand dark:text-brand-navy"
          >
            {disabled ? (
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            ) : null}
            Select
          </button>
        </div>
      </div>
    </article>
  );
}

function FlightOptionView({
  option,
  compact,
}: {
  option: FlightOptionDTO;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
      <RoutePoint
        label={option.origin.label}
        code={option.origin.code}
        time={formatDateTime(option.departureAt)}
      />
      <div className="text-center text-xs font-bold text-brand-blue/72 dark:text-brand-sand">
        <Plane aria-hidden="true" className="mx-auto mb-1 size-5" />
        {formatDuration(option.durationMinutes)}
        <span className="mt-1 block">
          {option.stopsCount === 0 ? "Non-stop" : `${option.stopsCount} stop`}
        </span>
      </div>
      <RoutePoint
        label={option.destination.label}
        code={option.destination.code}
        time={formatDateTime(option.arrivalAt)}
        alignRight
      />
      <div className="sm:col-span-3">
        <MetaRow
          items={[
            option.airlineName,
            option.flightNumber,
            option.cabin,
            option.baggageLabel,
            compact ? undefined : option.priceDelta.label,
          ]}
        />
      </div>
    </div>
  );
}

function HotelOptionView({
  option,
  compact,
}: {
  option: HotelOptionDTO;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <OptionImage
        src={option.imageUrl}
        alt={`${option.hotelName} hotel`}
        icon={Hotel}
      />
      <div className="min-w-0">
        <h4 className="text-lg font-extrabold">{option.hotelName}</h4>
        <MetaRow
          items={[
            option.address,
            option.roomName,
            option.boardBasis,
            `${option.nights} nights`,
            compact ? undefined : option.priceDelta.label,
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-brand-blue dark:text-brand-sand">
          {option.starRating ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-1 dark:bg-white/[0.08]">
              {option.starRating}
              <Star aria-hidden="true" className="size-3 fill-current" />
            </span>
          ) : null}
          {option.guestRating ? (
            <span className="rounded bg-surface-muted px-2 py-1 dark:bg-white/[0.08]">
              Guest rating {option.guestRating}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TransferOptionView({
  option,
  compact,
}: {
  option: TransferOptionDTO;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <OptionImage src={option.vehicleImageUrl} alt={option.title} icon={Car} />
      <div className="min-w-0">
        <h4 className="text-lg font-extrabold">{option.title}</h4>
        <p className="mt-1 text-sm font-semibold text-brand-navy/62 dark:text-white/62">
          {option.pickupLabel} to {option.dropoffLabel}
        </p>
        <MetaRow
          items={[
            `Pax ${option.paxMin}-${option.paxMax}`,
            option.luggageCount ? `Luggage ${option.luggageCount}` : undefined,
            formatDuration(option.durationMinutes),
            compact ? undefined : option.priceDelta.label,
          ]}
        />
      </div>
    </div>
  );
}

function ActivityOptionView({
  option,
  compact,
}: {
  option: ActivityOptionDTO;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <OptionImage src={option.imageUrl} alt={option.title} icon={Sparkles} />
      <div className="min-w-0">
        <h4 className="text-lg font-extrabold">{option.title}</h4>
        {option.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-brand-navy/62 dark:text-white/62">
            {option.description}
          </p>
        ) : null}
        <MetaRow
          items={[
            option.category,
            `Day ${option.dayOffset + 1}`,
            formatDuration(option.durationMinutes),
            option.pickupIncluded ? "Hotel pickup" : undefined,
            compact ? undefined : option.priceDelta.label,
          ]}
        />
      </div>
    </div>
  );
}

function RoutePoint({
  label,
  code,
  time,
  alignRight,
}: {
  label?: string;
  code?: string;
  time?: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-left sm:text-right" : undefined}>
      <p className="text-lg font-extrabold">{code ?? label}</p>
      {label && code ? (
        <p className="mt-1 truncate text-sm font-semibold text-brand-navy/62 dark:text-white/62">
          {label}
        </p>
      ) : null}
      {time ? (
        <p className="mt-2 text-xs font-bold text-brand-blue/70 dark:text-brand-sand">
          {time}
        </p>
      ) : null}
    </div>
  );
}

function OptionImage({
  src,
  alt,
  icon: Icon,
}: {
  src?: string;
  alt: string;
  icon: LucideIcon;
}) {
  return (
    <figure className="relative h-28 overflow-hidden rounded-lg bg-surface-muted dark:bg-white/[0.06]">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="140px"
          className="object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center text-brand-blue dark:text-brand-sand">
          <Icon aria-hidden="true" className="size-8" />
        </div>
      )}
    </figure>
  );
}

function MetaRow({ items }: { items: Array<string | number | undefined> }) {
  const filtered = items.filter(Boolean);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-brand-navy/62 dark:text-white/62">
      {filtered.map((item, index) => (
        <span key={`${String(item)}-${index}`}>{item}</span>
      ))}
    </div>
  );
}

function buildTimelineSummary(segments: ItinerarySegmentDTO[]) {
  return segments.map((segment) => ({
    segmentId: segment.id,
    title: segment.title,
    dateLabel: segment.dateLabel,
    selectedLabel: getOptionLabel(segment.selectedOption),
  }));
}

function calculateInitialDelta(
  segments: ItinerarySegmentDTO[],
  currency: string,
): MoneyDelta {
  const amount = segments.reduce(
    (sum, segment) => sum + (segment.selectedOption?.priceDelta.amount ?? 0),
    0,
  );

  return {
    currency,
    amount,
    label: `${amount >= 0 ? "+" : "-"} ${currency}${Math.abs(amount).toLocaleString(
      "en-US",
      { maximumFractionDigits: 0 },
    )}`,
  };
}

function getOptionLabel(option?: SegmentOptionDTO) {
  if (!option) {
    return undefined;
  }

  if (option.type === "flight") {
    return option.airlineName;
  }

  if (option.type === "hotel") {
    return option.hotelName;
  }

  return option.title;
}

function getOptionSearchPlaceholder(type: ItinerarySegmentDTO["type"]) {
  if (type === "flight") {
    return "Airline code, e.g. EK";
  }

  if (type === "hotel") {
    return "Hotel name";
  }

  if (type === "transfer") {
    return "Vehicle type";
  }

  return "Activity category";
}

function isOptionType(value: string): value is ItineraryOptionType {
  return (
    value === "flight" ||
    value === "hotel" ||
    value === "transfer" ||
    value === "activity"
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function formatDuration(minutes?: number) {
  if (!minutes || !Number.isFinite(minutes)) {
    return undefined;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload || !payload.ok) {
    throw new Error("Request failed");
  }

  return payload.data;
}
