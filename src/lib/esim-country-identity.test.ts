import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chooseCanonicalUkCountrySource,
  getEsimCountryIdentity,
  preferUkControlSource,
  rankEsimCountriesForSearch,
} from "./esim-country-identity.ts";

test("GB/Wales Airhub anomaly displays as United Kingdom UK", () => {
  const identity = getEsimCountryIdentity({
    isoCode: "GB",
    providerName: "Wales",
  });

  assert.equal(identity.isoCode, "UK");
  assert.equal(identity.displayName, "United Kingdom");
  assert.equal(identity.aliases.includes("GB"), true);
  assert.equal(identity.aliases.includes("Great Britain"), true);
  assert.equal(identity.aliases.includes("Wales"), true);
});

test("UK anomaly prefers the existing GB row as the control source", () => {
  assert.equal(
    preferUkControlSource({ candidateIsoCode: "GB", currentIsoCode: "UK" }),
    true,
  );
  assert.equal(
    preferUkControlSource({ candidateIsoCode: "UK", currentIsoCode: "GB" }),
    false,
  );
});

test("hidden GB control source hides duplicated UK publicly", () => {
  const selected = chooseCanonicalUkCountrySource([
    { isoCode: "UK", isVisible: true },
    { isoCode: "GB", isVisible: false },
  ]);

  assert.equal(selected?.isoCode, "GB");
  assert.equal(selected?.isVisible, false);
});

test("UK searches rank United Kingdom before Ukraine", () => {
  const results = rankEsimCountriesForSearch(
    [
      {
        isoCode: "UA",
        name: "Ukraine",
        aliases: [],
      },
      {
        isoCode: "UK",
        name: "United Kingdom",
        aliases: ["GB", "Great Britain", "Wales"],
      },
    ],
    "uk",
  );

  assert.deepEqual(
    results.map((country) => country.name),
    ["United Kingdom", "Ukraine"],
  );
});

test("GB searches return the normalized United Kingdom country", () => {
  const results = rankEsimCountriesForSearch(
    [
      {
        isoCode: "UK",
        name: "United Kingdom",
        aliases: ["GB", "Great Britain", "Wales"],
      },
      {
        isoCode: "UA",
        name: "Ukraine",
        aliases: [],
      },
    ],
    "gb",
  );

  assert.deepEqual(
    results.map((country) => country.isoCode),
    ["UK"],
  );
});
