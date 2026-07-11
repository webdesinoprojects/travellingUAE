import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_GALLERY_IMAGES,
  buildHotelGalleryImages,
  enrichRatesWithStaticRoomGroups,
  extractPaidOnSpot,
  extractSafeHotelPolicies,
  extractStaticRoomGroups,
  findStaticRoomGroupForRate,
  pickHotelAmenities,
} from "./hotel-content-display.ts";
import type { HotelRateDTO } from "@/types/hotels";

test("buildHotelGalleryImages: primary first, https-only, de-duped, capped", () => {
  const primary = "https://cdn.example.com/a.jpg";
  const images = [
    "https://cdn.example.com/a.jpg", // dup of primary
    "https://cdn.example.com/b.jpg",
    "http://cdn.example.com/insecure.jpg", // dropped (not https)
    "not-a-url", // dropped
    "https://cdn.example.com/c.jpg",
  ];
  assert.deepEqual(buildHotelGalleryImages(primary, images), [
    "https://cdn.example.com/a.jpg",
    "https://cdn.example.com/b.jpg",
    "https://cdn.example.com/c.jpg",
  ]);
});

test("buildHotelGalleryImages: works with no primary and caps at the max", () => {
  const many = Array.from({ length: 30 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
  const result = buildHotelGalleryImages(null, many);
  assert.equal(result.length, MAX_GALLERY_IMAGES);
  assert.equal(result[0], "https://cdn.example.com/0.jpg");
});

test("buildHotelGalleryImages: empty when nothing valid", () => {
  assert.deepEqual(buildHotelGalleryImages(null, null), []);
  assert.deepEqual(buildHotelGalleryImages("ftp://x/y.jpg", ["http://x/z.jpg"]), []);
});

test("pickHotelAmenities: trims, de-dupes case-insensitively, drops non-strings", () => {
  assert.deepEqual(
    pickHotelAmenities([" WiFi ", "wifi", "Pool", 42, null, "Parking"]),
    ["WiFi", "Pool", "Parking"],
  );
  assert.deepEqual(pickHotelAmenities("not-an-array"), []);
  assert.equal(pickHotelAmenities(Array.from({ length: 100 }, (_, i) => `a${i}`)).length, 40);
});

test("extractStaticRoomGroups: sanitizes image URLs and caps room-group payload", () => {
  const groups = extractStaticRoomGroups([
    {
      id: "rg1",
      name: "Double room",
      main_name: "Double room",
      images: [
        "https://cdn.example.test/1.jpg",
        "http://cdn.example.test/insecure.jpg",
        "https://cdn.example.test/1.jpg",
        ...Array.from({ length: 20 }, (_, index) => `https://cdn.example.test/${index + 2}.jpg`),
      ],
      amenities: ["Safe", " safe ", "Coffee"],
      rg_ext: { capacity: 2, bathroom: 2, raw: { no: true } },
      bed_type: "Full double bed",
      beds: ["2 single beds"],
      room_size_sqm: 21,
      smoking_label: "Non-smoking",
      has_bathroom: true,
      capacity: 2,
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].images.length, 8);
  assert.deepEqual(groups[0].amenities, ["Safe", "Coffee"]);
  assert.deepEqual(groups[0].rgExt, { bathroom: 2, capacity: 2 });
});

test("enrichRatesWithStaticRoomGroups: matches live rate by normalized room name", () => {
  const rate = hotelRate({
    roomName: "Double Room (2 Twin Beds)",
    roomGroupName: "Double room",
    roomImages: [],
    amenities: ["Non-smoking"],
  });
  const groups = extractStaticRoomGroups([
    {
      name: "Double room",
      images: ["https://cdn.example.test/double.jpg"],
      amenities: ["Safe", "Coffee"],
      beds: ["2 single beds"],
      room_size_sqm: 21,
      has_bathroom: true,
      capacity: 2,
    },
  ]);

  assert.equal(findStaticRoomGroupForRate(rate, groups)?.name, "Double room");
  const [enriched] = enrichRatesWithStaticRoomGroups([rate], groups);
  assert.deepEqual(enriched.roomImages, ["https://cdn.example.test/double.jpg"]);
  assert.deepEqual(enriched.amenities, ["Non-smoking", "Safe", "Coffee"]);
  assert.deepEqual(enriched.beds, ["2 single beds"]);
  assert.equal(enriched.roomSizeSqm, 21);
  assert.equal(enriched.hasBathroom, true);
  assert.equal(enriched.capacity, 2);
});

test("enrichRatesWithStaticRoomGroups: no match leaves room photos empty", () => {
  const rate = hotelRate({ roomName: "Suite", roomGroupName: "Suite" });
  const groups = extractStaticRoomGroups([
    {
      name: "Double room",
      images: ["https://cdn.example.test/double.jpg"],
    },
  ]);

  const [enriched] = enrichRatesWithStaticRoomGroups([rate], groups);
  assert.deepEqual(enriched.roomImages, []);
  assert.equal(enriched.roomPhotoCount, 0);
});

test("extractSafeHotelPolicies: only safe fields, null when empty, never raw JSON", () => {
  assert.deepEqual(
    extractSafeHotelPolicies({
      check_in_time: "14:00",
      check_out_time: "12:00",
      extra_info: "Photo ID required at check-in.",
      metapolicy_struct: { deposit: [{ amount: 100 }] },
      policy_struct: { foo: "bar" },
    }),
    {
      checkInTime: "14:00",
      checkOutTime: "12:00",
      extraInfo: "Photo ID required at check-in.",
    },
  );

  // Only the raw structs, no readable fields -> null (section hidden).
  assert.equal(
    extractSafeHotelPolicies({ metapolicy_struct: { x: 1 }, policy_struct: { y: 2 } }),
    null,
  );
  assert.equal(extractSafeHotelPolicies(null), null);
  assert.equal(extractSafeHotelPolicies([]), null);
});

test("extractPaidOnSpot: parses priced sections, skips empty/unspecified/free, no raw JSON", () => {
  const policies = {
    metapolicy_struct: {
      deposit: [], // empty -> skipped
      meal: [{ price: "18.00", currency: "EUR", inclusion: "not_included", price_unit: "per_guest" }],
      parking: [{ price: "500.00", currency: "RUB", inclusion: "not_included", price_unit: "per_car_per_night", territory_type: "unspecified" }],
      pets: [{ price: "0.00", currency: "RUB", inclusion: "not_included", price_unit: "per_guest_per_night" }], // price 0 -> skipped
      cot: [{ price: 0, currency: "RUB", inclusion: "not_included" }], // 0 -> skipped
      visa: { visa_support: "unspecified" }, // not an array -> ignored
    },
  };
  const items = extractPaidOnSpot(policies);
  assert.deepEqual(items, [
    { label: "Parking", amount: "500.00 RUB per car per night", note: "Paid on site" },
    { label: "Meals", amount: "18.00 EUR per guest", note: "Paid on site" },
  ]);

  // No raw JSON / object leakage anywhere.
  const serialized = JSON.stringify(items).toLowerCase();
  assert.equal(serialized.includes("territory_type"), false);
  assert.equal(serialized.includes("visa_support"), false);

  assert.deepEqual(extractPaidOnSpot(null), []);
  assert.deepEqual(extractPaidOnSpot({}), []);
  assert.deepEqual(extractPaidOnSpot({ metapolicy_struct: {} }), []);
});

function hotelRate(overrides: Partial<HotelRateDTO>): HotelRateDTO {
  return {
    rateId: "rate-1",
    roomName: null,
    boardBasis: null,
    priceAmount: 100,
    currency: "SAR",
    roomGroupName: null,
    roomImages: [],
    roomPhotoCount: 0,
    bedType: null,
    beds: [],
    roomSizeSqm: null,
    amenities: [],
    smokingLabel: null,
    hasBathroom: false,
    capacity: null,
    allotment: null,
    cancellationFreeBefore: null,
    cancellationPolicyCount: 0,
    paymentType: null,
    ...overrides,
  };
}
