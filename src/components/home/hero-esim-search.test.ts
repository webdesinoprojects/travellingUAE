import { test } from "node:test";
import assert from "node:assert/strict";

import type { AirhubPublicCountry } from "@/server/providers/airhub/contracts";

import {
  HERO_ESIM_SUGGESTION_LIMIT,
  buildHeroEsimCountryHref,
  filterHeroEsimCountries,
  readHeroEsimCountriesResponse,
} from "./hero-esim-search.ts";

const countries: AirhubPublicCountry[] = [
  country("IN", "India", "https://www.airhubapp.jp/assets/flags/India.svg"),
  country("ID", "Indonesia", null),
  country("GB", "United Kingdom", null),
  country("AE", "United Arab Emirates", null),
  country("IT", "Italy", null),
  country("IE", "Ireland", null),
  country("IS", "Iceland", null),
];

test("hero eSIM search limits top suggestions to Airhub country data", () => {
  const suggestions = filterHeroEsimCountries(countries, "", 3);

  assert.deepEqual(
    suggestions.map((item) => [item.isoCode, item.name]),
    [
      ["IN", "India"],
      ["ID", "Indonesia"],
      ["GB", "United Kingdom"],
    ],
  );
});

test("hero eSIM search matches by country name and ISO code", () => {
  assert.deepEqual(
    filterHeroEsimCountries(countries, "ind").map((item) => item.isoCode),
    ["IN", "ID"],
  );
  assert.deepEqual(
    filterHeroEsimCountries(countries, "gb").map((item) => item.name),
    ["United Kingdom"],
  );
});

test("hero eSIM search default suggestion count is six", () => {
  assert.equal(HERO_ESIM_SUGGESTION_LIMIT, 6);
  assert.equal(filterHeroEsimCountries(countries, "").length, 6);
});

test("hero eSIM route uses the real country code flow", () => {
  assert.equal(buildHeroEsimCountryHref("in"), "/esim/IN");
  assert.equal(buildHeroEsimCountryHref(" UK "), "/esim/UK");
});

test("hero eSIM countries response does not invent fallback data", () => {
  assert.deepEqual(readHeroEsimCountriesResponse({ countries: [] }), []);
  assert.deepEqual(readHeroEsimCountriesResponse({}), []);
});

test("hero eSIM countries response keeps Airhub names and flags", () => {
  assert.deepEqual(
    readHeroEsimCountriesResponse({ countries: [countries[0]] }),
    [countries[0]],
  );
});

test("hero eSIM countries response reads the public API data wrapper", () => {
  assert.deepEqual(
    readHeroEsimCountriesResponse({ ok: true, data: { countries: [countries[0]] } }),
    [countries[0]],
  );
});

function country(
  isoCode: string,
  name: string,
  flagUrl: string | null,
): AirhubPublicCountry {
  return {
    isoCode,
    name,
    regionName: null,
    flagUrl,
    globalFlagUrl: null,
  };
}
