"use client";

import {
  ArrowLeftRight,
  BedDouble,
  CalendarDays,
  ChevronDown,
  Clock,
  Minus,
  Plane,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";

type Travelers = {
  adults: number;
  children: number;
  infants: number;
};

type HeroTransfersSearchProps = {
  destinations: Array<{ slug: string; name: string }>;
};

export function HeroTransfersSearch({ destinations }: HeroTransfersSearchProps) {
  const router = useRouter();
  const [airport, setAirport] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("00:00");
  const [travelers, setTravelers] = useState<Travelers>({
    adults: 1,
    children: 0,
    infants: 0,
  });

  const totalTravelers = travelers.adults + travelers.children + travelers.infants;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      service: "transfers",
      adults: String(travelers.adults),
      children: String(travelers.children),
      infants: String(travelers.infants),
    });

    if (airport) params.set("from", airport);
    if (destination) params.set("to", destination);
    if (pickupDate) params.set("pickupDate", pickupDate);
    if (pickupTime) params.set("pickupTime", pickupTime);

    router.push(`/?${params.toString()}#contact`);
  }

  function swap() {
    setAirport(destination);
    setDestination(airport);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search airport transfers"
      className="grid min-w-0 gap-3"
    >
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_auto]">
        <div className="relative grid min-w-0 gap-3 sm:grid-cols-2">
          <LocationSelect
            icon={<Plane aria-hidden="true" className="size-5 text-brand-blue" />}
            label="Airport"
            placeholder="Select airport"
            value={airport}
            options={destinations}
            onChange={setAirport}
          />
          <LocationSelect
            icon={<BedDouble aria-hidden="true" className="size-5 text-brand-blue" />}
            label="Destination"
            placeholder="Select destination"
            value={destination}
            options={destinations}
            onChange={setDestination}
          />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap airport and destination"
            className="absolute left-1/2 top-1/2 hidden size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-brand-blue/30 bg-white text-brand-blue shadow-md transition hover:bg-brand-blue/10 sm:grid"
          >
            <ArrowLeftRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        <TravelerPopover
          label={travelersLabel(totalTravelers)}
          travelers={travelers}
          onChange={setTravelers}
        />

        <button
          type="submit"
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold uppercase tracking-widest text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
        >
          <Search aria-hidden="true" className="size-4" />
          Search now
        </button>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2 md:max-w-2xl">
        <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              Pickup date
            </span>
            <input
              type="date"
              value={pickupDate}
              onChange={(event) => setPickupDate(event.target.value)}
              className="block w-full bg-transparent text-sm font-extrabold outline-none"
              aria-label="Pickup date"
            />
          </span>
        </label>

        <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <Clock aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              Pickup time
            </span>
            <input
              type="time"
              value={pickupTime}
              onChange={(event) => setPickupTime(event.target.value)}
              className="block w-full bg-transparent text-sm font-extrabold outline-none"
              aria-label="Pickup time"
            />
          </span>
        </label>
      </div>
    </form>
  );
}

function LocationSelect({
  icon,
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  options: HeroTransfersSearchProps["destinations"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
          {label}
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full appearance-none truncate bg-transparent text-sm font-extrabold outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function TravelerPopover({
  label,
  travelers,
  onChange,
}: {
  label: string;
  travelers: Travelers;
  onChange: (value: Travelers) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const update = useCallback(
    (key: keyof Travelers, delta: number) => {
      const next = { ...travelers, [key]: travelers[key] + delta };
      if (key === "adults") {
        next.adults = clamp(next.adults, 1, 9);
      } else {
        next[key] = clamp(next[key], 0, 9);
      }
      onChange(next);
    },
    [onChange, travelers],
  );

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-left text-brand-navy"
      >
        <Users aria-hidden="true" className="size-5 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
            Traveller
          </span>
          <span className="block truncate text-sm font-extrabold">{label}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-brand-blue transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose travellers"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid max-h-[70vh] w-[min(92vw,340px)] gap-3 overflow-y-auto rounded-lg border border-brand-blue/10 bg-white p-4 text-brand-navy shadow-2xl"
        >
          <CounterRow
            title="Adults"
            helper="Ages 12 or above"
            value={travelers.adults}
            min={1}
            onDecrement={() => update("adults", -1)}
            onIncrement={() => update("adults", 1)}
          />
          <CounterRow
            title="Children"
            helper="Ages 2 - 11"
            value={travelers.children}
            min={0}
            onDecrement={() => update("children", -1)}
            onIncrement={() => update("children", 1)}
          />
          <CounterRow
            title="Infants"
            helper="Ages under 2"
            value={travelers.infants}
            min={0}
            onDecrement={() => update("infants", -1)}
            onIncrement={() => update("infants", 1)}
          />
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-brand-navy"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CounterRow({
  title,
  helper,
  value,
  min,
  onDecrement,
  onIncrement,
}: {
  title: string;
  helper: string;
  value: number;
  min: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-extrabold">{title}</p>
        <p className="text-xs font-semibold text-brand-blue/70">{helper}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${title}`}
          className="grid size-9 place-items-center rounded-full border border-brand-blue/30 text-brand-blue transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-brand-blue/10"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <span
          aria-live="polite"
          className="w-6 text-center text-sm font-extrabold"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increase ${title}`}
          className="grid size-9 place-items-center rounded-full border border-brand-blue/30 text-brand-blue transition hover:bg-brand-blue/10"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function travelersLabel(total: number) {
  if (total <= 0) return "0 travellers";
  if (total === 1) return "1 Adult";
  return `${total} travellers`;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
