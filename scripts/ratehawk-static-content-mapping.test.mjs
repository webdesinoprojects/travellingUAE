import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractAmenities,
  extractDescription,
  extractImageUrls,
  extractPolicies,
  extractRoomGroups,
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

test("extractRoomGroups stores sanitized real room group data with capped images", () => {
  const groups = extractRoomGroups({
    room_groups: [
      {
        id: "rg1",
        name: "Double room",
        main_name: "Double room",
        main_room_type: "Double room",
        images_ext: Array.from({ length: 12 }, (_, index) => ({
          url: `https://cdn.example.test/room/${index}/{size}.jpg`,
        })),
        room_amenities: [" Safe ", "Coffee", "Safe", "<b>Air conditioning</b>"],
        rg_ext: { capacity: 2, bathroom: 2, unsafe_payload: { no: true } },
        bedding_type: "full double bed",
        beds: [{ name: "single bed", count: 2 }],
        room_size: { square_meters: 21 },
        smoking: "non-smoking",
        has_bathroom: true,
      },
      {
        name: "Broken room",
        images_ext: [{ url: "http://cdn.example.test/not-allowed.jpg" }],
      },
    ],
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Double room");
  assert.equal(groups[0].images.length, 8);
  assert.equal(groups[0].images[0], "https://cdn.example.test/room/0/640x400.jpg");
  assert.deepEqual(groups[0].amenities, ["Safe", "Coffee", "Air conditioning"]);
  assert.deepEqual(groups[0].rg_ext, { bathroom: 2, capacity: 2 });
  assert.equal(groups[0].bed_type, "full double bed");
  assert.deepEqual(groups[0].beds, ["2 single bed"]);
  assert.equal(groups[0].room_size_sqm, 21);
  assert.equal(groups[0].smoking_label, "Non-smoking");
  assert.equal(groups[0].has_bathroom, true);
  assert.equal(groups[0].capacity, 2);
});

test("extractRoomGroups caps room groups at 30 and returns null when missing", () => {
  assert.equal(extractRoomGroups({}), null);
  const groups = extractRoomGroups({
    room_groups: Array.from({ length: 40 }, (_, index) => ({
      name: `Room ${index}`,
      images: [`https://cdn.example.test/${index}.jpg`],
    })),
  });
  assert.equal(groups.length, 30);
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
