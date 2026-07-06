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
  Trash2,
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

type PackageMode = "customised" | "ready-made" | "flight-hotel";

type CabinClass = "economy" | "premium-economy" | "business" | "first";

type Room = {
  id: string;
  adults: number;
  children: number;
  infants: number;
};

type HeroPackagesSearchProps = {
  destinations: Array<{ slug: string; name: string }>;
};

const CABIN_OPTIONS: Array<{ value: CabinClass; label: string }> = [
  { value: "economy", label: "Economy" },
  { value: "premium-economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const MAX_ROOMS = 3;
const MAX_PER_ROOM = 9;

export function HeroPackagesSearch({ destinations }: HeroPackagesSearchProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PackageMode>("customised");

  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [origin, setOrigin] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [cabin, setCabin] = useState<CabinClass>("economy");
  const [accommodationOnlyPart, setAccommodationOnlyPart] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(() => [createRoom()]);

  const totals = roomTotals(rooms);
  const cabinLabel =
    CABIN_OPTIONS.find((option) => option.value === cabin)?.label ?? "Economy";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      service: "packages",
      mode,
      rooms: String(rooms.length),
      adults: String(totals.adults),
      children: String(totals.children),
      infants: String(totals.infants),
    });

    if (destination) params.set("destination", destination);

    if (mode === "flight-hotel") {
      if (origin) params.set("from", origin);
      if (departure) params.set("depart", departure);
      if (returnDate) params.set("return", returnDate);
      params.set("cabin", cabin);
      if (accommodationOnlyPart) params.set("accommodationOnlyPart", "1");
    } else if (departure) {
      params.set("depart", departure);
    }

    router.push(
      destination
        ? `/trips/${destination}?${params.toString()}`
        : `/trips?${params.toString()}`,
    );
  }

  function addRoom() {
    setRooms((current) =>
      current.length >= MAX_ROOMS ? current : [...current, createRoom()],
    );
  }

  function removeRoom(id: string) {
    setRooms((current) =>
      current.length <= 1 ? current : current.filter((room) => room.id !== id),
    );
  }

  function updateRoom(id: string, patch: Partial<Omit<Room, "id">>) {
    setRooms((current) =>
      current.map((room) => (room.id === id ? { ...room, ...patch } : room)),
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search packages"
      className="grid min-w-0 gap-3"
    >
      <ModeTabs mode={mode} onSelect={setMode} />

      {mode === "flight-hotel" ? (
        <FlightHotelForm
          origin={origin}
          destination={destination}
          departure={departure}
          returnDate={returnDate}
          cabin={cabin}
          cabinLabel={cabinLabel}
          accommodationOnlyPart={accommodationOnlyPart}
          rooms={rooms}
          travellerLabelText={travellerLabel(rooms.length, totals)}
          destinations={destinations}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onDepartureChange={setDeparture}
          onReturnChange={setReturnDate}
          onCabinChange={setCabin}
          onAccommodationOnlyPartChange={setAccommodationOnlyPart}
          onAddRoom={addRoom}
          onRemoveRoom={removeRoom}
          onUpdateRoom={updateRoom}
        />
      ) : (
        <SimplePackageForm
          destination={destination}
          departure={departure}
          rooms={rooms}
          travellerLabelText={travellerLabel(rooms.length, totals)}
          destinations={destinations}
          onDestinationChange={setDestination}
          onDepartureChange={setDeparture}
          onAddRoom={addRoom}
          onRemoveRoom={removeRoom}
          onUpdateRoom={updateRoom}
        />
      )}
    </form>
  );
}

function ModeTabs({
  mode,
  onSelect,
}: {
  mode: PackageMode;
  onSelect: (value: PackageMode) => void;
}) {
  const modes: Array<{
    value: PackageMode;
    label: string;
    mobileLabel: string;
  }> = [
    {
      value: "customised",
      label: "Customised packages",
      mobileLabel: "Customised",
    },
    {
      value: "ready-made",
      label: "Ready-made packages",
      mobileLabel: "Ready-made",
    },
    {
      value: "flight-hotel",
      label: "Flight + hotel",
      mobileLabel: "Flight + hotel",
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Package type"
      className="grid w-full max-w-2xl grid-cols-3 gap-1 self-start rounded-full border border-white/22 bg-white/12 p-1 backdrop-blur-md"
    >
      {modes.map((item) => {
        const isActive = mode === item.value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={item.label}
            onClick={() => onSelect(item.value)}
            className={`min-h-10 min-w-0 rounded-full px-2 text-[11px] font-extrabold tracking-normal transition sm:px-4 sm:text-sm ${
              isActive
                ? "bg-brand-sand text-brand-navy shadow-[0_6px_18px_rgb(7_23_57/0.25)]"
                : "text-white hover:bg-white/18"
            }`}
          >
            <span className="block truncate sm:hidden">{item.mobileLabel}</span>
            <span className="hidden truncate sm:block">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SimplePackageForm({
  destination,
  departure,
  rooms,
  travellerLabelText,
  destinations,
  onDestinationChange,
  onDepartureChange,
  onAddRoom,
  onRemoveRoom,
  onUpdateRoom,
}: {
  destination: string;
  departure: string;
  rooms: Room[];
  travellerLabelText: string;
  destinations: HeroPackagesSearchProps["destinations"];
  onDestinationChange: (value: string) => void;
  onDepartureChange: (value: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onUpdateRoom: (id: string, patch: Partial<Omit<Room, "id">>) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
      <DestinationSelect
        icon={<MapPin aria-hidden="true" className="size-5 text-brand-blue" />}
        label="Destination"
        placeholder="Select destination"
        value={destination}
        options={destinations}
        onChange={onDestinationChange}
      />
      <DateField label="Departure" value={departure} onChange={onDepartureChange} />
      <TravelerPopover
        label={travellerLabelText}
        rooms={rooms}
        onAdd={onAddRoom}
        onRemove={onRemoveRoom}
        onUpdate={onUpdateRoom}
      />
      <SubmitButton />
    </div>
  );
}

function FlightHotelForm({
  origin,
  destination,
  departure,
  returnDate,
  cabin,
  cabinLabel,
  accommodationOnlyPart,
  rooms,
  travellerLabelText,
  destinations,
  onOriginChange,
  onDestinationChange,
  onDepartureChange,
  onReturnChange,
  onCabinChange,
  onAccommodationOnlyPartChange,
  onAddRoom,
  onRemoveRoom,
  onUpdateRoom,
}: {
  origin: string;
  destination: string;
  departure: string;
  returnDate: string;
  cabin: CabinClass;
  cabinLabel: string;
  accommodationOnlyPart: boolean;
  rooms: Room[];
  travellerLabelText: string;
  destinations: HeroPackagesSearchProps["destinations"];
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onDepartureChange: (value: string) => void;
  onReturnChange: (value: string) => void;
  onCabinChange: (value: CabinClass) => void;
  onAccommodationOnlyPartChange: (value: boolean) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onUpdateRoom: (id: string, patch: Partial<Omit<Room, "id">>) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
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
        <DateField
          label="Dates"
          value={departure}
          onChange={onDepartureChange}
          rangeValue={returnDate}
          onRangeChange={onReturnChange}
        />
        <SubmitButton />
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <TravelerPopover
          label={travellerLabelText}
          rooms={rooms}
          onAdd={onAddRoom}
          onRemove={onRemoveRoom}
          onUpdate={onUpdateRoom}
        />
        <CabinSelect value={cabin} label={cabinLabel} onChange={onCabinChange} />
        <label className="flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <input
            type="checkbox"
            checked={accommodationOnlyPart}
            onChange={(event) =>
              onAccommodationOnlyPartChange(event.target.checked)
            }
            className="size-4 shrink-0 rounded border border-brand-blue/30 accent-brand-blue"
          />
          <span className="min-w-0 flex-1 text-xs font-extrabold uppercase tracking-[0.1em]">
            Only need accommodation for part of my trip
          </span>
        </label>
      </div>
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
  options: HeroPackagesSearchProps["destinations"];
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
  rangeValue,
  onRangeChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rangeValue?: string;
  onRangeChange?: (value: string) => void;
}) {
  const isRange = typeof rangeValue === "string" && Boolean(onRangeChange);

  return (
    <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
      <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
          {label}
        </span>
        {isRange ? (
          <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
            <input
              type="date"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-label="Departure"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
            <span aria-hidden="true" className="text-brand-blue/60">
              –
            </span>
            <input
              type="date"
              value={rangeValue}
              min={value || undefined}
              onChange={(event) => onRangeChange?.(event.target.value)}
              aria-label="Return"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
        ) : (
          <input
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="block w-full bg-transparent text-sm font-extrabold outline-none"
            aria-label={label}
          />
        )}
      </span>
    </label>
  );
}

function TravelerPopover({
  label,
  rooms,
  onAdd,
  onRemove,
  onUpdate,
}: {
  label: string;
  rooms: Room[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<Room, "id">>) => void;
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

  const adjust = useCallback(
    (room: Room, key: keyof Omit<Room, "id">, delta: number) => {
      const min = key === "adults" ? 1 : 0;
      const next = clamp(room[key] + delta, min, MAX_PER_ROOM);
      onUpdate(room.id, { [key]: next } as Partial<Omit<Room, "id">>);
    },
    [onUpdate],
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
          aria-label="Choose rooms and travellers"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid max-h-[70vh] w-[min(92vw,340px)] gap-4 overflow-y-auto rounded-lg border border-brand-blue/10 bg-white p-4 text-brand-navy shadow-2xl"
        >
          {rooms.map((room, index) => (
            <section
              key={room.id}
              className="grid gap-3 border-b border-brand-blue/10 pb-3 last:border-b-0 last:pb-0"
            >
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold">Room {index + 1}</h3>
                {rooms.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemove(room.id)}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </button>
                ) : null}
              </header>

              <CounterRow
                title="Adults"
                helper="Ages 12 or above"
                value={room.adults}
                min={1}
                onDecrement={() => adjust(room, "adults", -1)}
                onIncrement={() => adjust(room, "adults", 1)}
              />
              <CounterRow
                title="Children"
                helper="Ages 2 - 11"
                value={room.children}
                min={0}
                onDecrement={() => adjust(room, "children", -1)}
                onIncrement={() => adjust(room, "children", 1)}
              />
              <CounterRow
                title="Infants"
                helper="Ages under 2"
                value={room.infants}
                min={0}
                onDecrement={() => adjust(room, "infants", -1)}
                onIncrement={() => adjust(room, "infants", 1)}
              />
            </section>
          ))}

          <div className="grid gap-2">
            {rooms.length < MAX_ROOMS ? (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-rose-300 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-rose-600 hover:bg-rose-50"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add room
              </button>
            ) : null}
            <p className="text-xs font-semibold text-brand-blue/70">
              Maximum {MAX_ROOMS} rooms per booking.
            </p>
            <p className="text-xs font-semibold text-brand-blue/70">
              Child / infant age should be based on return date.
            </p>
          </div>

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

function SubmitButton() {
  return (
    <button
      type="submit"
      className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
    >
      <Search aria-hidden="true" className="size-4" />
      Search now
    </button>
  );
}

function travellerLabel(
  roomCount: number,
  totals: { adults: number; children: number; infants: number },
) {
  const parts: string[] = [];
  parts.push(`${roomCount} ${roomCount === 1 ? "Room" : "Rooms"}`);
  parts.push(`${totals.adults} ${totals.adults === 1 ? "Adult" : "Adults"}`);
  if (totals.children > 0) {
    parts.push(
      `${totals.children} ${totals.children === 1 ? "Child" : "Children"}`,
    );
  }
  if (totals.infants > 0) {
    parts.push(
      `${totals.infants} ${totals.infants === 1 ? "Infant" : "Infants"}`,
    );
  }
  return parts.join(", ");
}

function roomTotals(rooms: Room[]) {
  return rooms.reduce(
    (acc, room) => {
      acc.adults += room.adults;
      acc.children += room.children;
      acc.infants += room.infants;
      return acc;
    },
    { adults: 0, children: 0, infants: 0 },
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function createRoom(): Room {
  return {
    id: Math.random().toString(36).slice(2, 10),
    adults: 1,
    children: 0,
    infants: 0,
  };
}
