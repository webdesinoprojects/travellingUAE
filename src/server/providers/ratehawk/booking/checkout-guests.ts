import type { CheckoutGuestGender, CheckoutGuestRoom } from "../../../../types/itinerary";

export type ValidatedCheckoutGuestGender = CheckoutGuestGender;

export type ValidatedCheckoutGuest = {
  firstName: string;
  lastName: string;
  gender: ValidatedCheckoutGuestGender;
  age?: number;
  isChild?: boolean;
};

export type ValidatedCheckoutGuestRoom = {
  guests: ValidatedCheckoutGuest[];
};

export type CheckoutGuestValidationResult =
  | { ok: true; rooms?: ValidatedCheckoutGuestRoom[] }
  | { ok: false; code: string };

const BAD_NAME_VALUES = new Set(["guest", "n/a", "na", "unknown"]);
const ALLOWED_GENDERS = new Set<CheckoutGuestGender>(["male", "female", "unknown"]);

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ");

  if (cleaned.length < 1 || cleaned.length > 80) {
    return null;
  }

  if (BAD_NAME_VALUES.has(cleaned.toLowerCase())) {
    return null;
  }

  return cleaned;
}

function cleanGender(value: unknown): CheckoutGuestGender {
  if (typeof value !== "string") {
    return "unknown";
  }

  const cleaned = value.trim().toLowerCase();
  return ALLOWED_GENDERS.has(cleaned as CheckoutGuestGender)
    ? (cleaned as CheckoutGuestGender)
    : "unknown";
}

function sameAge(expected: number | undefined, provided: unknown): boolean {
  if (expected == null) {
    return provided == null;
  }

  return typeof provided === "number" && Number.isInteger(provided) && provided === expected;
}

export function validateCheckoutGuestRooms(
  input: unknown,
  expected: CheckoutGuestRoom[] | undefined,
): CheckoutGuestValidationResult {
  if (!expected || expected.length === 0) {
    return { ok: true };
  }

  if (!Array.isArray(input) || input.length !== expected.length) {
    return { ok: false, code: "guest_rooms_mismatch" };
  }

  const rooms: ValidatedCheckoutGuestRoom[] = [];

  for (let roomIndex = 0; roomIndex < expected.length; roomIndex += 1) {
    const expectedRoom = expected[roomIndex];
    const providedRoom = input[roomIndex];

    if (!providedRoom || typeof providedRoom !== "object" || Array.isArray(providedRoom)) {
      return { ok: false, code: "guest_room_invalid" };
    }

    const rawGuests = (providedRoom as Record<string, unknown>).guests;

    if (!Array.isArray(rawGuests) || rawGuests.length !== expectedRoom.guests.length) {
      return { ok: false, code: "guest_count_mismatch" };
    }

    const guests: ValidatedCheckoutGuest[] = [];

    for (let guestIndex = 0; guestIndex < expectedRoom.guests.length; guestIndex += 1) {
      const expectedGuest = expectedRoom.guests[guestIndex];
      const rawGuest = rawGuests[guestIndex];

      if (!rawGuest || typeof rawGuest !== "object" || Array.isArray(rawGuest)) {
        return { ok: false, code: "guest_invalid" };
      }

      const guest = rawGuest as Record<string, unknown>;

      if (guest.kind !== expectedGuest.kind || !sameAge(expectedGuest.age, guest.age)) {
        return { ok: false, code: "guest_occupancy_mismatch" };
      }

      const firstName = cleanName(guest.firstName);
      const lastName = cleanName(guest.lastName);

      if (!firstName || !lastName) {
        return { ok: false, code: "guest_name_required" };
      }

      guests.push({
        firstName,
        lastName,
        gender: cleanGender(guest.gender),
        ...(expectedGuest.kind === "child" ? { isChild: true } : {}),
        ...(expectedGuest.age != null ? { age: expectedGuest.age } : {}),
      });
    }

    rooms.push({ guests });
  }

  return { ok: true, rooms };
}
