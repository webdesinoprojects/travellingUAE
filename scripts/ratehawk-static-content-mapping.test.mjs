import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractAmenities,
  extractDescription,
  extractImageUrls,
  extractPolicies,
  mapHotel,
} from "./ratehawk-static-content-mapping.mjs";

test("extractImageUrls returns unique https URLs with size applied and max 15", () => {
  const payload = {
    images_ext: Array.from({ length: 20 }, (_, index) => ({
      url: `https://cdn.example.test/hotel/${index}/{size}.jpg`,
    })),
    images: [
      "https://cdn.example.test/hotel/0/640x400.jpg",
      "http://cdn.example.test/not-allowed.jpg",
      "not a url",
    ],
  };

  const urls = extractImageUrls(payload);

  assert.equal(urls.length, 15);
  assert.equal(urls[0], "https://cdn.example.test/hotel/0/640x400.jpg");
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.some((url) => url.startsWith("http://")), false);
});

test("mapHotel chooses first extracted image as primary image", () => {
  const row = mapHotel(
    {
      id: "hotel_1",
      name: "Test Hotel",
      images_ext: [
        { url: "https://cdn.example.test/b/{size}.jpg" },
        { url: "https://cdn.example.test/a/{size}.jpg" },
      ],
    },
    "provider-id",
    "en",
  );

  assert.equal(row.primary_image_url, "https://cdn.example.test/b/640x400.jpg");
  assert.deepEqual(row.image_urls, [
    "https://cdn.example.test/b/640x400.jpg",
    "https://cdn.example.test/a/640x400.jpg",
  ]);
});

test("extractAmenities accepts nested provider groups and removes junk", () => {
  const amenities = extractAmenities({
    amenities: [" Free Wi-Fi ", "", "<b>Spa</b>", "Free Wi-Fi"],
    amenity_groups: [
      {
        name: "Room amenities",
        amenities: [{ name: "Air conditioning" }, { id: "parking" }],
      },
    ],
    serp_filters: [{ title: "Breakfast" }],
  });

  assert.deepEqual(amenities, [
    "Free Wi-Fi",
    "Spa",
    "Room amenities",
    "Air conditioning",
    "parking",
    "Breakfast",
  ]);
});

test("extractDescription reads plain text from provider description shapes", () => {
  assert.equal(
    extractDescription({
      description_struct: [
        { title: "Overview", paragraphs: ["<p>Central hotel.</p>", "Near the metro."] },
      ],
    }),
    "Overview Central hotel. Near the metro.",
  );
});

test("extractPolicies preserves safe policy/check-in/check-out fields", () => {
  const policies = extractPolicies({
    check_in_time: "14:00",
    check_out_time: "12:00",
    metapolicy_extra_info: "<p>Deposit may be required.</p>",
    metapolicy_struct: {
      meal: [{ inclusion: "not_included", price: 20 }],
      "bad key with spaces": "removed",
    },
  });

  assert.equal(policies.check_in_time, "14:00");
  assert.equal(policies.check_out_time, "12:00");
  assert.equal(policies.extra_info, "Deposit may be required.");
  assert.deepEqual(policies.metapolicy_struct.meal, [{ inclusion: "not_included", price: 20 }]);
  assert.equal("bad key with spaces" in policies.metapolicy_struct, false);
});

test("mapHotel handles missing optional fields without crashing", () => {
  const row = mapHotel({ id: "minimal", name: "Minimal Hotel" }, "provider-id", "en");

  assert.equal(row.hotel_id, "minimal");
  assert.equal(row.primary_image_url, null);
  assert.deepEqual(row.image_urls, []);
  assert.deepEqual(row.amenities, []);
  assert.deepEqual(row.policies, {});
  assert.equal(row.description, null);
});
