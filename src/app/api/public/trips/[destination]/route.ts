import { type NextRequest } from "next/server";

import {
  getPublicTripDestination,
  getPublicTripDestinations,
} from "@/server/public/dal";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ destination: string }> },
) {
  try {
    const { destination: destinationSlug } = await context.params;
    const destination = await getPublicTripDestination(destinationSlug);

    if (!destination) {
      return jsonError(404, "The requested package list was not found.");
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const city = url.searchParams.get("city") ?? "all";
    const flights = url.searchParams.get("flights");
    const minDuration = Number(url.searchParams.get("minDuration") ?? 0);
    const maxDuration = Number(url.searchParams.get("maxDuration") ?? 999);
    const sort = url.searchParams.get("sort") ?? "recommended";
    const categories = new Set(
      url.searchParams
        .getAll("categories")
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter(Boolean),
    );
    const stars = new Set(
      url.searchParams
        .getAll("stars")
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter(Boolean),
    );

    const packages = destination.packages
      .filter((pkg) => {
        const matchesKeyword =
          !q ||
          [pkg.title, pkg.city, pkg.overview, ...pkg.tags, ...pkg.categories]
            .join(" ")
            .toLowerCase()
            .includes(q);
        const matchesCity = city === "all" || pkg.city === city;
        const matchesFlights =
          flights !== "with" && flights !== "without"
            ? true
            : flights === "with"
              ? pkg.hasFlights
              : !pkg.hasFlights;
        const matchesDuration =
          pkg.durationDays >= minDuration && pkg.durationDays <= maxDuration;
        const matchesCategories =
          categories.size === 0 ||
          Array.from(categories).every((category) =>
            pkg.categories.includes(category),
          );
        const matchesStars =
          stars.size === 0 ||
          Array.from(stars).some((star) =>
            star === "<3" ? pkg.hotelStar < 3 : pkg.hotelStar === Number(star),
          );

        return (
          matchesKeyword &&
          matchesCity &&
          matchesFlights &&
          matchesDuration &&
          matchesCategories &&
          matchesStars
        );
      })
      .toSorted((left, right) => {
        if (sort === "cheapest") {
          return left.priceAmount - right.priceAmount;
        }

        if (sort === "duration") {
          return left.durationDays - right.durationDays;
        }

        return Number(right.badge === "Recommended") - Number(left.badge === "Recommended");
      });

    return jsonOk({
      destination: {
        ...destination,
        packages,
        resultCount: `Showing 1 - ${packages.length} of ${packages.length} Packages`,
      },
      destinations: await getPublicTripDestinations(),
      filters: {
        q,
        city,
        flights,
        minDuration,
        maxDuration,
        categories: Array.from(categories),
        stars: Array.from(stars),
        sort,
      },
      total: packages.length,
    });
  } catch (error) {
    logServerError("api.public.trips.destination", error);
    return jsonError(500);
  }
}

