"use client";

import { Minus, Plus, Trash2, Users } from "lucide-react";
import { useMemo } from "react";

import { getCountryOptions } from "@/data/countries";

export type HotelRoomOccupancy = {
  id: string;
  adults: number;
  children: number[];
};

export type HotelOccupancy = {
  residency: string;
  rooms: HotelRoomOccupancy[];
};

type HotelOccupancyFieldsProps = {
  value: HotelOccupancy;
  onChange: (value: HotelOccupancy) => void;
  disabled?: boolean;
  compact?: boolean;
};

const MAX_ROOMS = 4;
const MAX_ADULTS_PER_ROOM = 6;
const MAX_CHILDREN_PER_ROOM = 4;

export function HotelOccupancyFields({
  value,
  onChange,
  disabled = false,
  compact = false,
}: HotelOccupancyFieldsProps) {
  const countries = useMemo(() => getCountryOptions("en"), []);
  const totalGuests = value.rooms.reduce(
    (total, room) => total + room.adults + room.children.length,
    0,
  );

  function updateRoom(
    roomId: string,
    update: (room: HotelRoomOccupancy) => HotelRoomOccupancy,
  ) {
    onChange({
      ...value,
      rooms: value.rooms.map((room) =>
        room.id === roomId ? update(room) : room,
      ),
    });
  }

  function addRoom() {
    if (disabled || value.rooms.length >= MAX_ROOMS) return;

    onChange({
      ...value,
      rooms: [
        ...value.rooms,
        {
          id: `room-${Date.now()}-${value.rooms.length + 1}`,
          adults: 1,
          children: [],
        },
      ],
    });
  }

  function removeRoom(roomId: string) {
    if (disabled || value.rooms.length <= 1) return;
    onChange({
      ...value,
      rooms: value.rooms.filter((room) => room.id !== roomId),
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users aria-hidden="true" className="size-4 shrink-0 text-brand-blue dark:text-brand-sand" />
          <p className="text-sm font-extrabold text-brand-navy dark:text-white">
            {totalGuests} {totalGuests === 1 ? "guest" : "guests"}, {value.rooms.length}{" "}
            {value.rooms.length === 1 ? "room" : "rooms"}
          </p>
        </div>
        <button
          type="button"
          onClick={addRoom}
          disabled={disabled || value.rooms.length >= MAX_ROOMS}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-soft px-3 text-xs font-extrabold text-brand-blue transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45 dark:text-brand-sand dark:hover:bg-white/[0.06]"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add room
        </button>
      </div>

      <label className="grid min-w-0 gap-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-brand-navy/62 dark:text-white/62">
          Passport country
        </span>
        <select
          value={value.residency}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, residency: event.target.value })
          }
          className="h-11 min-w-0 rounded-lg border border-border-soft bg-surface px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue disabled:cursor-not-allowed disabled:opacity-60 dark:bg-black dark:text-white"
          aria-label="Passport country used for hotel pricing"
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        <span className="text-xs leading-5 text-brand-navy/55 dark:text-white/55">
          Hotel prices can depend on the lead guest&apos;s passport country.
        </span>
      </label>

      <div className="grid gap-3">
        {value.rooms.map((room, roomIndex) => (
          <div
            key={room.id}
            className="grid min-w-0 gap-3 border-t border-border-soft pt-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-blue/75 dark:text-brand-sand">
                Room {roomIndex + 1}
              </p>
              {value.rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  disabled={disabled}
                  aria-label={`Remove room ${roomIndex + 1}`}
                  className="grid size-8 place-items-center rounded-lg text-brand-navy/55 transition hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45 dark:text-white/55"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>

            <CounterField
              label="Adults"
              value={room.adults}
              min={1}
              max={MAX_ADULTS_PER_ROOM}
              disabled={disabled}
              onChange={(adults) =>
                updateRoom(room.id, (current) => ({ ...current, adults }))
              }
            />

            <CounterField
              label="Children"
              value={room.children.length}
              min={0}
              max={MAX_CHILDREN_PER_ROOM}
              disabled={disabled}
              onChange={(count) =>
                updateRoom(room.id, (current) => ({
                  ...current,
                  children:
                    count > current.children.length
                      ? [...current.children, ...Array(count - current.children.length).fill(7)]
                      : current.children.slice(0, count),
                }))
              }
            />

            {room.children.length > 0 ? (
              <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
                {room.children.map((age, childIndex) => (
                  <label key={`${room.id}-child-${childIndex}`} className="grid gap-1">
                    <span className="text-xs font-semibold text-brand-navy/60 dark:text-white/60">
                      Child {childIndex + 1} age
                    </span>
                    <select
                      value={age}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRoom(room.id, (current) => ({
                          ...current,
                          children: current.children.map((currentAge, index) =>
                            index === childIndex
                              ? Number.parseInt(event.target.value, 10)
                              : currentAge,
                          ),
                        }))
                      }
                      className="h-10 rounded-lg border border-border-soft bg-surface px-2 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue disabled:cursor-not-allowed disabled:opacity-60 dark:bg-black dark:text-white"
                    >
                      {Array.from({ length: 18 }, (_, index) => (
                        <option key={index} value={index}>
                          {index}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <span className="text-sm font-bold text-brand-navy dark:text-white">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="grid size-9 place-items-center rounded-lg border border-border-soft transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <output className="w-6 text-center text-sm font-black">{value}</output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="grid size-9 place-items-center rounded-lg border border-border-soft transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function createDefaultHotelOccupancy(): HotelOccupancy {
  return {
    residency: "ae",
    rooms: [{ id: "room-1", adults: 2, children: [] }],
  };
}

export function totalHotelGuests(occupancy: HotelOccupancy): number {
  return occupancy.rooms.reduce(
    (total, room) => total + room.adults + room.children.length,
    0,
  );
}

export function serializeHotelRoom(room: HotelRoomOccupancy): string {
  return `${room.adults}:${room.children.join(",")}`;
}
