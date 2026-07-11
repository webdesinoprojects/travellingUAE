import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeHotelFacets,
  filterAndSortHotels,
  isDefaultHotelFilter,
  DEFAULT_HOTEL_FILTER,
  type HotelFilterState,
} from "./hotel-search-filter.ts";
import type { HotelSearchCardDTO } from "@/types/hotels";

function hotel(overrides: Partial<HotelSearchCardDTO>): HotelSearchCardDTO {
  return {
    quoteId: Math.random().toString(36),
    hotelId: "h",
    name: "Hotel",
    address: null,
    imageUrl: null,
    starRating: null,
    roomName: null,
    boardBasis: null,
    priceAmount: 100,
    currency: "SAR",
    nights: 1,
    ...overrides,
  };
}

const sample: HotelSearchCardDTO[] = [
  hotel({ name: "Alpha Inn", starRating: 3, boardBasis: "Room Only", priceAmount: 200, imageUrl: "https://x/a.jpg" }),
  hotel({ name: "Beta Resort", starRating: 5, boardBasis: "Breakfast Included", priceAmount: 500, imageUrl: "https://x/b.jpg" }),
  hotel({ name: "Gamma Lodge", starRating: 3, boardBasis: "Room Only", priceAmount: 150, imageUrl: null }),
  hotel({ name: "Delta Suites", starRating: null, boardBasis: null, priceAmount: 320, imageUrl: "https://x/d.jpg" }),
];

test("computeHotelFacets returns real counts from loaded results", () => {
  const facets = computeHotelFacets(sample);
  assert.equal(facets.total, 4);
  assert.deepEqual(facets.stars, [
    { value: 5, count: 1 },
    { value: 3, count: 2 },
  ]);
  assert.deepEqual(
    facets.boards.map((b) => `${b.label}:${b.count}`),
    ["Room Only:2", "Breakfast Included:1"],
  );
  assert.equal(facets.priceMin, 150);
  assert.equal(facets.priceMax, 500);
  assert.equal(facets.currency, "SAR");
  assert.equal(facets.withImageCount, 3);
});

test("filterAndSortHotels: name search across name + address", () => {
  const res = filterAndSortHotels(sample, { ...DEFAULT_HOTEL_FILTER, name: "beta" });
  assert.deepEqual(res.map((h) => h.name), ["Beta Resort"]);
});

test("filterAndSortHotels: star + board + price + image filters", () => {
  const filter: HotelFilterState = {
    ...DEFAULT_HOTEL_FILTER,
    stars: [3],
    boards: ["Room Only"],
    minPrice: 160,
    maxPrice: 400,
    onlyWithImage: true,
  };
  // Alpha (3★, Room Only, 200, has image) passes; Gamma fails (no image, 150<160).
  assert.deepEqual(filterAndSortHotels(sample, filter).map((h) => h.name), ["Alpha Inn"]);
});

test("filterAndSortHotels: sort by price asc/desc, star desc, name", () => {
  assert.deepEqual(
    filterAndSortHotels(sample, { ...DEFAULT_HOTEL_FILTER, sort: "price_asc" }).map((h) => h.priceAmount),
    [150, 200, 320, 500],
  );
  assert.deepEqual(
    filterAndSortHotels(sample, { ...DEFAULT_HOTEL_FILTER, sort: "price_desc" }).map((h) => h.priceAmount),
    [500, 320, 200, 150],
  );
  assert.equal(
    filterAndSortHotels(sample, { ...DEFAULT_HOTEL_FILTER, sort: "star_desc" })[0].name,
    "Beta Resort",
  );
  assert.deepEqual(
    filterAndSortHotels(sample, { ...DEFAULT_HOTEL_FILTER, sort: "name_asc" }).map((h) => h.name),
    ["Alpha Inn", "Beta Resort", "Delta Suites", "Gamma Lodge"],
  );
});

test("recommended sort preserves provider order", () => {
  assert.deepEqual(
    filterAndSortHotels(sample, DEFAULT_HOTEL_FILTER).map((h) => h.name),
    ["Alpha Inn", "Beta Resort", "Gamma Lodge", "Delta Suites"],
  );
});

test("isDefaultHotelFilter", () => {
  assert.equal(isDefaultHotelFilter(DEFAULT_HOTEL_FILTER), true);
  assert.equal(isDefaultHotelFilter({ ...DEFAULT_HOTEL_FILTER, stars: [5] }), false);
});
