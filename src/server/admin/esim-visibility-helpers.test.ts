import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computePlanPageCount,
  filterAdminPlans,
  indexControlsByPlanCode,
  isPlanVisibleByControls,
  mergePlanControlsForAdmin,
  normalizeCountryAdminQuery,
  normalizePlanAdminQuery,
  paginate,
  rankPublicCountries,
  resolveCountryDisplayName,
  sortAdminPlans,
  toVisiblePublicPlans,
  type PlanControlRow,
  type PlanFlatSource,
} from "./esim-visibility-helpers.ts";

test("resolveCountryDisplayName prefers a non-empty override", () => {
  assert.equal(resolveCountryDisplayName("France", "Frankreich"), "Frankreich");
  assert.equal(resolveCountryDisplayName("France", "   "), "France");
  assert.equal(resolveCountryDisplayName("France", null), "France");
});

test("toVisiblePublicPlans hides plans, sorts featured-first, and leaks no admin fields", () => {
  const plans = [
    { planCode: "A", planName: "a" },
    { planCode: "B", planName: "b" },
    { planCode: "C", planName: "c" },
  ];
  const controls = indexControlsByPlanCode([
    row("US", "B", { is_visible: false, admin_note: "SECRET-NOTE" }),
    row("US", "C", { is_featured: true, disabled_reason: "SECRET-REASON" }),
  ]);

  const visible = toVisiblePublicPlans(plans, controls);

  // B hidden; C is featured so it sorts first; A keeps provider order after.
  assert.deepEqual(
    visible.map((plan) => plan.planCode),
    ["C", "A"],
  );

  // Returned objects are the untouched plan shape — no admin fields attached.
  assert.deepEqual(Object.keys(visible[0]).sort(), ["planCode", "planName"]);
  const serialized = JSON.stringify(visible);
  assert.equal(serialized.includes("SECRET-NOTE"), false);
  assert.equal(serialized.includes("SECRET-REASON"), false);
  assert.equal(serialized.includes("admin_note"), false);
});

test("isPlanVisibleByControls defaults to visible when no control exists", () => {
  const controls = indexControlsByPlanCode([row("US", "HIDDEN", { is_visible: false })]);
  assert.equal(isPlanVisibleByControls(controls, "HIDDEN"), false);
  assert.equal(isPlanVisibleByControls(controls, "hidden"), false); // case-insensitive
  assert.equal(isPlanVisibleByControls(controls, "OTHER"), true);
});

test("mergePlanControlsForAdmin applies defaults and merges controls", () => {
  const plans: PlanFlatSource[] = [
    { countryCode: "US", planCode: "A", planName: "a", price: 3, currency: "USD" },
    { countryCode: "US", planCode: "B", planName: "b", price: 5, currency: "USD" },
  ];
  const merged = mergePlanControlsForAdmin(plans, [
    row("US", "B", { is_visible: false, is_featured: true, sort_order: 4, admin_note: "n" }),
  ]);

  const a = merged.find((item) => item.planCode === "A")!;
  const b = merged.find((item) => item.planCode === "B")!;
  assert.equal(a.isVisible, true);
  assert.equal(a.hasControl, false);
  assert.equal(b.isVisible, false);
  assert.equal(b.isFeatured, true);
  assert.equal(b.sortOrder, 4);
  assert.equal(b.adminNote, "n");
  assert.equal(b.hasControl, true);
});

test("filterAdminPlans + sortAdminPlans + paginate", () => {
  const items = mergePlanControlsForAdmin(
    [
      { countryCode: "US", planCode: "A", planName: "Alpha", price: 3, currency: "USD" },
      { countryCode: "US", planCode: "B", planName: "Beta", price: 5, currency: "USD" },
      { countryCode: "FR", planCode: "C", planName: "Gamma", price: 7, currency: "EUR" },
    ],
    [row("US", "B", { is_visible: false })],
  );

  const hidden = filterAdminPlans(items, {
    filter: "hidden",
    countryCode: "all",
    search: "",
    page: 1,
    pageSize: 30,
  });
  assert.deepEqual(hidden.map((item) => item.planCode), ["B"]);

  const byCountry = filterAdminPlans(items, {
    filter: "all",
    countryCode: "FR",
    search: "",
    page: 1,
    pageSize: 30,
  });
  assert.deepEqual(byCountry.map((item) => item.planCode), ["C"]);

  const search = filterAdminPlans(items, {
    filter: "all",
    countryCode: "all",
    search: "alpha",
    page: 1,
    pageSize: 30,
  });
  assert.deepEqual(search.map((item) => item.planCode), ["A"]);

  assert.equal(sortAdminPlans(items)[0].countryCode, "FR"); // country-ordered
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), [3, 4]);
  assert.equal(computePlanPageCount(31, 30), 2);
});

test("normalizePlanAdminQuery validates country + filter + page", () => {
  assert.deepEqual(
    normalizePlanAdminQuery({ filter: "hidden", country: "us", q: "x", page: "2" }),
    { filter: "hidden", countryCode: "US", search: "x", page: 2, pageSize: 30 },
  );
  assert.equal(normalizePlanAdminQuery({ country: "USA" }).countryCode, "all");
  assert.equal(normalizePlanAdminQuery({ filter: "nope" }).filter, "all");
});

test("normalizeCountryAdminQuery validates filter + page", () => {
  assert.deepEqual(normalizeCountryAdminQuery({ filter: "hidden", q: "x", page: "3" }), {
    filter: "hidden",
    search: "x",
    page: 3,
    pageSize: 30,
  });
  assert.equal(normalizeCountryAdminQuery({ page: "0" }).page, 1);
});

test("rankPublicCountries ranks by relevance and preserves order on ties", () => {
  const countries = [
    { isoCode: "BH", name: "Bahrain", regionName: "Middle East" },
    { isoCode: "BD", name: "Bangladesh", regionName: "Asia" },
    { isoCode: "BB", name: "Barbados", regionName: "Caribbean" },
    { isoCode: "IN", name: "India", regionName: "Asia" },
  ];

  // "bang" -> only Bangladesh (name startsWith).
  assert.deepEqual(
    rankPublicCountries(countries, "bang").map((c) => c.isoCode),
    ["BD"],
  );

  // "ba" -> Bahrain/Bangladesh/Barbados all startsWith "Ba"; tie order preserved.
  assert.deepEqual(
    rankPublicCountries(countries, "ba").map((c) => c.isoCode),
    ["BH", "BD", "BB"],
  );

  // exact ISO beats a name startsWith match.
  assert.equal(rankPublicCountries(countries, "in")[0].isoCode, "IN");

  // region fallback (lowest bucket).
  assert.deepEqual(
    rankPublicCountries(countries, "caribbean").map((c) => c.isoCode),
    ["BB"],
  );

  // empty query returns everything unchanged.
  assert.equal(rankPublicCountries(countries, "  ").length, 4);
});

test("rankPublicCountries supports UK aliases and ranks UK before Ukraine", () => {
  const countries = [
    {
      isoCode: "UA",
      name: "Ukraine",
      regionName: "Europe",
      aliases: [],
    },
    {
      isoCode: "UK",
      name: "United Kingdom",
      regionName: "Europe",
      aliases: ["GB", "Great Britain", "Wales"],
    },
  ];

  assert.deepEqual(
    rankPublicCountries(countries, "uk").map((country) => country.name),
    ["United Kingdom", "Ukraine"],
  );
  assert.deepEqual(
    rankPublicCountries(countries, "gb").map((country) => country.name),
    ["United Kingdom"],
  );
});

function row(
  country: string,
  plan: string,
  overrides: Partial<PlanControlRow>,
): PlanControlRow {
  return {
    country_code: country,
    plan_code: plan,
    is_visible: true,
    is_featured: false,
    sort_order: 0,
    disabled_reason: null,
    admin_note: null,
    ...overrides,
  };
}
