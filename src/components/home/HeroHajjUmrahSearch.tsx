"use client";

import {
  CalendarDays,
  ChevronDown,
  MapPin,
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
  useRef,
  useState,
  type FormEvent,
} from "react";

type Room = {
  id: string;
  adults: number;
  children: number;
  infants: number;
};

type HeroHajjUmrahSearchProps = {
  destinations: Array<{ slug: string; name: string }>;
};

const MAX_ROOMS = 3;
const MAX_PER_ROOM = 9;

export function HeroHajjUmrahSearch({ destinations }: HeroHajjUmrahSearchProps) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [rooms, setRooms] = useState<Room[]>(() => [createRoom()]);

  const totals = roomTotals(rooms);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      service: "hajj-umrah",
      rooms: String(rooms.length),
      adults: String(totals.adults),
      children: String(totals.children),
      infants: String(totals.infants),
    });

    if (destination) params.set("destination", destination);
    if (departure) params.set("depart", departure);

    router.push(`/hajj-umrah?${params.toString()}`);
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
      aria-label="Search Umrah packages"
      className="grid min-w-0 gap-3"
    >
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
        <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <MapPin aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              Destination
            </span>
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className="block w-full appearance-none truncate bg-transparent text-sm font-extrabold outline-none"
            >
              <option value="">Select destination</option>
              {destinations.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              Departure
            </span>
            <input
              type="date"
              value={departure}
              onChange={(event) => setDeparture(event.target.value)}
              className="block w-full bg-transparent text-sm font-extrabold outline-none"
              aria-label="Departure"
            />
          </span>
        </label>

        <TravelerPopover
          label={travellerLabel(rooms.length, totals)}
          rooms={rooms}
          onAdd={addRoom}
          onRemove={removeRoom}
          onUpdate={updateRoom}
        />

        <button
          type="submit"
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold uppercase tracking-widest text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
        >
          <Search aria-hidden="true" className="size-4" />
          Search now
        </button>
      </div>
    </form>
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-rose-300 px-4 text-xs font-extrabold uppercase tracking-widest text-rose-600 hover:bg-rose-50"
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
