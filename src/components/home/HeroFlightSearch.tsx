"use client";

import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  MapPin,
  Minus,
  Plane,
  Plus,
  Search,
  Users,
  X,
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

type FlightMode = "round-trip" | "one-way" | "multi-city";

type CabinClass = "economy" | "premium-economy" | "business" | "first";

type Travelers = {
  adults: number;
  children: number;
  infants: number;
};

type FlightLeg = {
  id: string;
  origin: string;
  destination: string;
  departure: string;
};

type HeroFlightSearchProps = {
  destinations: Array<{ slug: string; name: string }>;
};

const CABIN_OPTIONS: Array<{ value: CabinClass; label: string }> = [
  { value: "economy", label: "Economy" },
  { value: "premium-economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const MAX_LEGS = 4;

export function HeroFlightSearch({ destinations }: HeroFlightSearchProps) {
  const router = useRouter();
  const [mode, setMode] = useState<FlightMode>("round-trip");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState<Travelers>({
    adults: 1,
    children: 0,
    infants: 0,
  });
  const [cabin, setCabin] = useState<CabinClass>("economy");
  const [legs, setLegs] = useState<FlightLeg[]>(() => [
    createLeg(),
    createLeg(),
  ]);

  const totalTravelers = travelers.adults + travelers.children + travelers.infants;
  const cabinLabel =
    CABIN_OPTIONS.find((option) => option.value === cabin)?.label ?? "Economy";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams({
      service: "flight",
      mode,
      adults: String(travelers.adults),
      children: String(travelers.children),
      infants: String(travelers.infants),
      cabin,
    });

    if (mode === "multi-city") {
      legs.forEach((leg, index) => {
        if (leg.origin) params.set(`leg${index + 1}From`, leg.origin);
        if (leg.destination) params.set(`leg${index + 1}To`, leg.destination);
        if (leg.departure) params.set(`leg${index + 1}Date`, leg.departure);
      });
    } else {
      if (origin) params.set("from", origin);
      if (destination) params.set("to", destination);
      if (departDate) params.set("depart", departDate);
      if (mode === "round-trip" && returnDate) {
        params.set("return", returnDate);
      }
    }

    router.push(`/?${params.toString()}#contact`);
  }

  function addLeg() {
    setLegs((current) =>
      current.length >= MAX_LEGS ? current : [...current, createLeg()],
    );
  }

  function removeLeg(id: string) {
    setLegs((current) =>
      current.length <= 2 ? current : current.filter((leg) => leg.id !== id),
    );
  }

  function updateLeg(id: string, patch: Partial<Omit<FlightLeg, "id">>) {
    setLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)),
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search flights"
      className="grid min-w-0 gap-3"
    >
      <ModeTabs mode={mode} onSelect={setMode} />

      {mode === "multi-city" ? (
        <MultiCityForm
          legs={legs}
          destinations={destinations}
          travelersLabel={travelersLabel(totalTravelers)}
          travelers={travelers}
          setTravelers={setTravelers}
          cabin={cabin}
          cabinLabel={cabinLabel}
          setCabin={setCabin}
          onAdd={addLeg}
          onRemove={removeLeg}
          onUpdate={updateLeg}
        />
      ) : (
        <SimpleFlightForm
          mode={mode}
          origin={origin}
          destination={destination}
          departDate={departDate}
          returnDate={returnDate}
          destinations={destinations}
          travelersLabel={travelersLabel(totalTravelers)}
          travelers={travelers}
          setTravelers={setTravelers}
          cabin={cabin}
          cabinLabel={cabinLabel}
          setCabin={setCabin}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onDepartChange={setDepartDate}
          onReturnChange={setReturnDate}
        />
      )}

      <button
        type="submit"
        className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
      >
        <Search aria-hidden="true" className="size-4" />
        Search flights
      </button>
    </form>
  );
}

function ModeTabs({
  mode,
  onSelect,
}: {
  mode: FlightMode;
  onSelect: (value: FlightMode) => void;
}) {
  const modes: Array<{ value: FlightMode; label: string }> = [
    { value: "round-trip", label: "Round Trip" },
    { value: "one-way", label: "One Way" },
    { value: "multi-city", label: "Multi City" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Flight trip type"
      className="inline-flex w-full max-w-md flex-wrap gap-1 self-start rounded-full border border-white/22 bg-white/12 p-1 backdrop-blur-md"
    >
      {modes.map((item) => {
        const isActive = mode === item.value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(item.value)}
            className={`min-h-9 flex-1 rounded-full px-4 text-xs font-extrabold uppercase tracking-[0.08em] transition sm:text-sm sm:normal-case sm:tracking-normal ${
              isActive
                ? "bg-brand-sand text-brand-navy shadow-[0_6px_18px_rgb(7_23_57/0.25)]"
                : "text-white hover:bg-white/18"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SimpleFlightForm({
  mode,
  origin,
  destination,
  departDate,
  returnDate,
  destinations,
  travelersLabel: travelersText,
  travelers,
  setTravelers,
  cabin,
  cabinLabel,
  setCabin,
  onOriginChange,
  onDestinationChange,
  onDepartChange,
  onReturnChange,
}: {
  mode: FlightMode;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  destinations: HeroFlightSearchProps["destinations"];
  travelersLabel: string;
  travelers: Travelers;
  setTravelers: (value: Travelers) => void;
  cabin: CabinClass;
  cabinLabel: string;
  setCabin: (value: CabinClass) => void;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onDepartChange: (value: string) => void;
  onReturnChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <DestinationSelect
          icon={<Plane aria-hidden="true" className="size-5 text-brand-blue" />}
          label="Origin"
          placeholder="Select origin"
          value={origin}
          options={destinations}
          onChange={onOriginChange}
        />
        <DestinationSelect
          icon={<MapPin aria-hidden="true" className="size-5 text-brand-blue" />}
          label="Destination"
          placeholder="Select destination"
          value={destination}
          options={destinations}
          onChange={onDestinationChange}
        />
      </div>

      <div
        className={`grid min-w-0 gap-3 ${
          mode === "round-trip" ? "md:grid-cols-2" : "md:grid-cols-1"
        }`}
      >
        <DateField
          label="Departure"
          value={departDate}
          onChange={onDepartChange}
        />
        {mode === "round-trip" ? (
          <DateField
            label="Return"
            value={returnDate}
            onChange={onReturnChange}
            min={departDate || undefined}
          />
        ) : null}
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <TravelerPopover
          label={travelersText}
          travelers={travelers}
          onChange={setTravelers}
        />
        <CabinSelect value={cabin} label={cabinLabel} onChange={setCabin} />
      </div>
    </div>
  );
}

function MultiCityForm({
  legs,
  destinations,
  travelersLabel: travelersText,
  travelers,
  setTravelers,
  cabin,
  cabinLabel,
  setCabin,
  onAdd,
  onRemove,
  onUpdate,
}: {
  legs: FlightLeg[];
  destinations: HeroFlightSearchProps["destinations"];
  travelersLabel: string;
  travelers: Travelers;
  setTravelers: (value: Travelers) => void;
  cabin: CabinClass;
  cabinLabel: string;
  setCabin: (value: CabinClass) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<FlightLeg, "id">>) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <TravelerPopover
          label={travelersText}
          travelers={travelers}
          onChange={setTravelers}
        />
        <CabinSelect value={cabin} label={cabinLabel} onChange={setCabin} />
      </div>

      <div className="grid min-w-0 gap-4">
        {legs.map((leg, index) => (
          <fieldset
            key={leg.id}
            className="grid min-w-0 gap-2 rounded-lg border border-white/20 bg-white/8 p-3"
          >
            <legend className="flex items-center justify-between gap-2 px-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/85">
              <span>Flight {index + 1}</span>
              {index >= 2 ? (
                <button
                  type="button"
                  onClick={() => onRemove(leg.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-rose-200 transition hover:text-rose-100"
                >
                  <X aria-hidden="true" className="size-3" />
                  Remove
                </button>
              ) : null}
            </legend>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <DestinationSelect
                icon={<Plane aria-hidden="true" className="size-5 text-brand-blue" />}
                label="Origin"
                placeholder="Select origin"
                value={leg.origin}
                options={destinations}
                onChange={(value) => onUpdate(leg.id, { origin: value })}
              />
              <DestinationSelect
                icon={<MapPin aria-hidden="true" className="size-5 text-brand-blue" />}
                label="Destination"
                placeholder="Select destination"
                value={leg.destination}
                options={destinations}
                onChange={(value) => onUpdate(leg.id, { destination: value })}
              />
              <DateField
                label="Departure"
                value={leg.departure}
                onChange={(value) => onUpdate(leg.id, { departure: value })}
              />
            </div>
          </fieldset>
        ))}
      </div>

      {legs.length < MAX_LEGS ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-dashed border-white/40 px-4 text-xs font-extrabold uppercase tracking-[0.12em] text-white transition hover:border-brand-sand hover:bg-white/10"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add another flight
        </button>
      ) : null}
    </div>
  );
}

function DestinationSelect({
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
  options: HeroFlightSearchProps["destinations"];
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

function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  return (
    <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
      <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
          {label}
        </span>
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          className="block w-full bg-transparent text-sm font-extrabold outline-none"
          aria-label={label}
        />
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
          <TravelerRow
            title="Adults"
            helper="Ages 12 or above"
            value={travelers.adults}
            min={1}
            onDecrement={() => update("adults", -1)}
            onIncrement={() => update("adults", 1)}
          />
          <TravelerRow
            title="Children"
            helper="Ages 2 - 11"
            value={travelers.children}
            min={0}
            onDecrement={() => update("children", -1)}
            onIncrement={() => update("children", 1)}
          />
          <TravelerRow
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
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white hover:bg-brand-navy"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TravelerRow({
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

function CabinSelect({
  value,
  label,
  onChange,
}: {
  value: CabinClass;
  label: string;
  onChange: (value: CabinClass) => void;
}) {
  return (
    <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
      <Briefcase aria-hidden="true" className="size-5 text-brand-blue" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
          Cabin class
        </span>
        <span className="sr-only">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as CabinClass)}
          className="block w-full appearance-none truncate bg-transparent text-sm font-extrabold outline-none"
          aria-label="Cabin class"
        >
          {CABIN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <ChevronDown
        aria-hidden="true"
        className="size-4 shrink-0 text-brand-blue"
      />
    </label>
  );
}

function travelersLabel(total: number) {
  if (total <= 0) return "0 travellers";
  if (total === 1) return "1 traveller";
  return `${total} travellers`;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function createLeg(): FlightLeg {
  return {
    id: Math.random().toString(36).slice(2, 10),
    origin: "",
    destination: "",
    departure: "",
  };
}
