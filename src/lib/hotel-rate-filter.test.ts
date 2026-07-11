import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_RATE_FILTER,
  computeRateFacets,
  filterAndSortRates,
  isDefaultRateFilter,
} from "./hotel-rate-filter.ts";
import type { HotelRateDTO } from "@/types/hotels";

function rate(o: Partial<HotelRateDTO>): HotelRateDTO {
  return {
    rateId: Math.random().toString(36),
    roomName: "Room",
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
    ...o,
  };
}

const rates: HotelRateDTO[] = [
  rate({ roomName: "Double Room", boardBasis: "Room Only", priceAmount: 420, paymentType: "hotel" }),
  rate({
    roomName: "Superior Double",
    boardBasis: "Breakfast Included",
    priceAmount: 450,
    bedType: "King bed",
    paymentType: "now",
    cancellationFreeBefore: "2026-07-11T10:30:00",
  }),
  rate({ roomName: "Twin Room", boardBasis: "Room Only", priceAmount: 400, beds: ["Twin bed"], smokingLabel: "Non-smoking" }),
];

test("computeRateFacets: real meal counts", () => {
  const f = computeRateFacets(rates);
  assert.equal(f.total, 3);
  assert.deepEqual(f.meals.map((m) => `${m.value}:${m.count}`), ["Room Only:2", "Breakfast Included:1"]);
  assert.deepEqual(f.paymentTypes.map((m) => `${m.value}:${m.count}`), ["hotel:1", "now:1"]);
  assert.deepEqual(f.beds.map((m) => `${m.value}:${m.count}`), ["King bed:1", "Twin bed:1"]);
  assert.equal(f.hasCancellation, true);
});

test("filterAndSortRates: meal filter + query + price sort", () => {
  assert.deepEqual(
    filterAndSortRates(rates, { ...DEFAULT_RATE_FILTER, meals: ["Room Only"] }).map((r) => r.roomName),
    ["Double Room", "Twin Room"],
  );
  assert.deepEqual(
    filterAndSortRates(rates, { ...DEFAULT_RATE_FILTER, query: "superior" }).map((r) => r.roomName),
    ["Superior Double"],
  );
  assert.deepEqual(
    filterAndSortRates(rates, { ...DEFAULT_RATE_FILTER, sort: "price_asc" }).map((r) => r.priceAmount),
    [400, 420, 450],
  );
  assert.deepEqual(
    filterAndSortRates(rates, { ...DEFAULT_RATE_FILTER, beds: ["King bed"] }).map((r) => r.roomName),
    ["Superior Double"],
  );
  assert.deepEqual(
    filterAndSortRates(rates, { ...DEFAULT_RATE_FILTER, paymentTypes: ["now"], freeCancellationOnly: true }).map((r) => r.roomName),
    ["Superior Double"],
  );
});

test("recommended sort preserves order; isDefaultRateFilter", () => {
  assert.deepEqual(
    filterAndSortRates(rates, DEFAULT_RATE_FILTER).map((r) => r.priceAmount),
    [420, 450, 400],
  );
  assert.equal(isDefaultRateFilter(DEFAULT_RATE_FILTER), true);
  assert.equal(isDefaultRateFilter({ ...DEFAULT_RATE_FILTER, meals: ["x"] }), false);
  assert.equal(isDefaultRateFilter({ ...DEFAULT_RATE_FILTER, freeCancellationOnly: true }), false);
});
