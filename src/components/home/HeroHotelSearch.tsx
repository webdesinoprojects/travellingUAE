"use client";

import {
  CalendarDays,
  ChevronDown,
  Minus,
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
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { getCountryOptions } from "@/data/countries";
import {
  HotelDestinationCombobox,
  type HotelDestinationSelection,
} from "@/components/hotels/HotelDestinationCombobox";

type Room = {
  id: string;
  adults: number;
  childAges: number[];
  infantAges: number[];
};

const MAX_ROOMS = 4;
const MAX_ADULTS_PER_ROOM = 6;
const MAX_CHILDREN_PER_ROOM = 4;
const CHILD_AGE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 2); // 2..11
const INFANT_AGE_OPTIONS = [0, 1];

export function HeroHotelSearch() {
  const router = useRouter();
  const [destination, setDestination] =
    useState<HotelDestinationSelection | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [rooms, setRooms] = useState<Room[]>(() => [createRoom()]);
  const [residency, setResidency] = useState("ae");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = roomTotals(rooms);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!destination || !checkIn || !checkOut) {
      setError("Choose a destination, check-in date, and check-out date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const isHotelSelection = destination.type === "hotel";
      const response = await fetch("/api/public/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          providerRegionId: destination.regionId,
          destinationName: destination.name,
          destinationCountryCode: destination.countryCode,
          selectedHotelId: isHotelSelection ? destination.hotelId : undefined,
          selectedHid: isHotelSelection ? destination.hid : undefined,
          checkIn,
          checkOut,
          residency,
          rooms: rooms.map((room) => ({
            adults: room.adults,
            children: [...room.infantAges, ...room.childAges],
          })),
          currency: "SAR",
          language: "en",
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { searchId?: string; hotelId?: string | null };
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.data?.searchId) {
        throw new Error(payload.message || "Hotel search is unavailable.");
      }

      const searchId = encodeURIComponent(payload.data.searchId);
      const hotelId = payload.data.hotelId;

      if (hotelId) {
        router.push(`/hotels/${encodeURIComponent(hotelId)}?search=${searchId}`);
        return;
      }

      router.push(`/hotels?search=${searchId}`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "We could not search hotels right now. Please try again.",
      );
      setIsSubmitting(false);
    }
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
      aria-label="Search hotels"
      className="grid min-w-0 gap-3"
    >
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
        <HotelDestinationCombobox value={destination} onChange={setDestination} />
        <DateRangeField
          checkIn={checkIn}
          checkOut={checkOut}
          onCheckInChange={setCheckIn}
          onCheckOutChange={setCheckOut}
        />
        <TravelerPopover
          label={travellerLabel(rooms.length, totals)}
          rooms={rooms}
          residency={residency}
          onResidencyChange={setResidency}
          onAdd={addRoom}
          onRemove={removeRoom}
          onUpdate={updateRoom}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy disabled:cursor-wait disabled:opacity-65 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
        >
          <Search aria-hidden="true" className="size-4" />
          {isSubmitting ? "Searching..." : "Search now"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-950/80 px-4 py-3 text-sm font-bold text-white">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function DateRangeField({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
}: {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
      <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
          Dates
        </span>
        <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
          <input
            type="date"
            value={checkIn}
            onChange={(event) => onCheckInChange(event.target.value)}
            aria-label="Check in"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          <span aria-hidden="true" className="text-brand-blue/60">
            –
          </span>
          <input
            type="date"
            value={checkOut}
            onChange={(event) => onCheckOutChange(event.target.value)}
            aria-label="Check out"
            min={checkIn || undefined}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </span>
      </span>
    </div>
  );
}

function TravelerPopover({
  label,
  rooms,
  residency,
  onResidencyChange,
  onAdd,
  onRemove,
  onUpdate,
}: {
  label: string;
  rooms: Room[];
  residency: string;
  onResidencyChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<Room, "id">>) => void;
}) {
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => getCountryOptions("en"), []);
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

  const handleAdults = useCallback(
    (room: Room, delta: number) => {
      const next = clamp(room.adults + delta, 1, MAX_ADULTS_PER_ROOM);
      onUpdate(room.id, { adults: next });
    },
    [onUpdate],
  );

  const handleChildren = useCallback(
    (room: Room, delta: number) => {
      const nextCount = clamp(
        room.childAges.length + delta,
        0,
        MAX_CHILDREN_PER_ROOM - room.infantAges.length,
      );
      const nextAges = resizeAges(room.childAges, nextCount, 2);
      onUpdate(room.id, { childAges: nextAges });
    },
    [onUpdate],
  );

  const handleInfants = useCallback(
    (room: Room, delta: number) => {
      const nextCount = clamp(
        room.infantAges.length + delta,
        0,
        MAX_CHILDREN_PER_ROOM - room.childAges.length,
      );
      const nextAges = resizeAges(room.infantAges, nextCount, 0);
      onUpdate(room.id, { infantAges: nextAges });
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
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid max-h-[70vh] w-[min(92vw,360px)] gap-4 overflow-y-auto rounded-lg border border-brand-blue/10 bg-white p-4 text-brand-navy shadow-2xl"
        >
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-blue/70">
              Lead guest passport country
            </span>
            <select
              value={residency}
              onChange={(event) => onResidencyChange(event.target.value)}
              className="h-11 rounded-lg border border-brand-blue/20 bg-white px-3 text-sm font-extrabold text-brand-navy outline-none focus:border-brand-blue"
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          {rooms.map((room, index) => (
            <RoomCard
              key={room.id}
              room={room}
              index={index}
              canRemove={rooms.length > 1}
              onRemove={() => onRemove(room.id)}
              onAdultsChange={(delta) => handleAdults(room, delta)}
              onChildrenChange={(delta) => handleChildren(room, delta)}
              onInfantsChange={(delta) => handleInfants(room, delta)}
              onChildAgeChange={(childIndex, age) => {
                const ages = [...room.childAges];
                ages[childIndex] = age;
                onUpdate(room.id, { childAges: ages });
              }}
              onInfantAgeChange={(infantIndex, age) => {
                const ages = [...room.infantAges];
                ages[infantIndex] = age;
                onUpdate(room.id, { infantAges: ages });
              }}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {rooms.length < MAX_ROOMS ? (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-brand-blue/40 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-brand-blue hover:bg-brand-blue/5"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add room
              </button>
            ) : (
              <span className="text-xs font-bold text-brand-blue/70">
                Maximum {MAX_ROOMS} rooms
              </span>
            )}
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

function RoomCard({
  room,
  index,
  canRemove,
  onRemove,
  onAdultsChange,
  onChildrenChange,
  onInfantsChange,
  onChildAgeChange,
  onInfantAgeChange,
}: {
  room: Room;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onAdultsChange: (delta: number) => void;
  onChildrenChange: (delta: number) => void;
  onInfantsChange: (delta: number) => void;
  onChildAgeChange: (childIndex: number, age: number) => void;
  onInfantAgeChange: (infantIndex: number, age: number) => void;
}) {
  return (
    <section className="grid gap-3 border-b border-brand-blue/10 pb-3 last:border-b-0 last:pb-0">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold">Room {index + 1}</h3>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
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
        onDecrement={() => onAdultsChange(-1)}
        onIncrement={() => onAdultsChange(1)}
      />

      <div className="grid gap-2">
        <CounterRow
          title="Children"
          helper="Ages 2 - 11"
          value={room.childAges.length}
          min={0}
          onDecrement={() => onChildrenChange(-1)}
          onIncrement={() => onChildrenChange(1)}
        />
        {room.childAges.map((age, childIndex) => (
          <AgeSelect
            key={`${room.id}-child-${childIndex}`}
            label={`Child age #${childIndex + 1}`}
            value={age}
            options={CHILD_AGE_OPTIONS}
            onChange={(next) => onChildAgeChange(childIndex, next)}
          />
        ))}
      </div>

      <div className="grid gap-2">
        <CounterRow
          title="Infants"
          helper="Ages under 2"
          value={room.infantAges.length}
          min={0}
          onDecrement={() => onInfantsChange(-1)}
          onIncrement={() => onInfantsChange(1)}
        />
        {room.infantAges.map((age, infantIndex) => (
          <AgeSelect
            key={`${room.id}-infant-${infantIndex}`}
            label={`Infant age #${infantIndex + 1}`}
            value={age}
            options={INFANT_AGE_OPTIONS}
            onChange={(next) => onInfantAgeChange(infantIndex, next)}
          />
        ))}
      </div>
    </section>
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

function AgeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-brand-blue/20 bg-white px-3 text-sm font-bold text-brand-navy">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-blue/70">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bg-transparent text-sm font-extrabold outline-none"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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
      acc.children += room.childAges.length;
      acc.infants += room.infantAges.length;
      return acc;
    },
    { adults: 0, children: 0, infants: 0 },
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function resizeAges(
  current: number[],
  nextLength: number,
  defaultValue: number,
): number[] {
  if (nextLength === current.length) return current;
  if (nextLength < current.length) return current.slice(0, nextLength);

  return [
    ...current,
    ...Array.from({ length: nextLength - current.length }, () => defaultValue),
  ];
}

function createRoom(): Room {
  return {
    id: Math.random().toString(36).slice(2, 10),
    adults: 2,
    childAges: [],
    infantAges: [],
  };
}
