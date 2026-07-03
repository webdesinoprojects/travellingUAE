"use client";

import { CalendarDays, MapPinned, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";
import { moreSearchServices, primarySearchServices } from "@/data/travel";
import { HeroFlightSearch } from "@/components/home/HeroFlightSearch";
import { HeroHajjUmrahSearch } from "@/components/home/HeroHajjUmrahSearch";
import { HeroHotelSearch } from "@/components/home/HeroHotelSearch";
import { HeroEsimSearch } from "@/components/home/HeroEsimSearch";
import { HeroPackagesSearch } from "@/components/home/HeroPackagesSearch";
import { HeroTransfersSearch } from "@/components/home/HeroTransfersSearch";
import { TravelIcon } from "@/components/ui/TravelIcon";
import type { HeroTab, SearchServiceKey } from "@/types/travel";

type DestinationOption = {
  slug: string;
  name: string;
};

type HeroSearchProps = {
  destinations: DestinationOption[];
  initialService: SearchServiceKey;
  moreLabel: string;
  serviceLabels: Partial<Record<SearchServiceKey, string>>;
};

type SearchCopy = {
  whereLabel: string;
  wherePlaceholder: string;
  dateLabel: string;
  travelerLabel: string;
  travelerPlaceholder: string;
  submitLabel: string;
  formLabel: string;
};

const serviceCopy: Record<SearchServiceKey, SearchCopy> = {
  flight: {
    whereLabel: "Route",
    wherePlaceholder: "Select route",
    dateLabel: "Departure",
    travelerLabel: "Passengers",
    travelerPlaceholder: "Passengers",
    submitLabel: "Search flights",
    formLabel: "Search flights",
  },
  hotel: {
    whereLabel: "Stay in",
    wherePlaceholder: "Select city",
    dateLabel: "Check in",
    travelerLabel: "Guests",
    travelerPlaceholder: "Guests",
    submitLabel: "Search hotels",
    formLabel: "Search hotels",
  },
  packages: {
    whereLabel: "Where to?",
    wherePlaceholder: "Select destination",
    dateLabel: "When",
    travelerLabel: "Travelers",
    travelerPlaceholder: "Guests",
    submitLabel: "Search",
    formLabel: "Search holiday packages",
  },
  wellness: {
    whereLabel: "Stay type",
    wherePlaceholder: "Select destination",
    dateLabel: "Check in",
    travelerLabel: "Guests",
    travelerPlaceholder: "Guests",
    submitLabel: "Plan wellness",
    formLabel: "Search wellness stays",
  },
  "hajj-umrah": {
    whereLabel: "Pilgrimage route",
    wherePlaceholder: "Select package",
    dateLabel: "Travel month",
    travelerLabel: "Travelers",
    travelerPlaceholder: "Travelers",
    submitLabel: "Search routes",
    formLabel: "Search Hajj and Umrah routes",
  },
  visa: {
    whereLabel: "Visa for",
    wherePlaceholder: "Select country",
    dateLabel: "Travel date",
    travelerLabel: "Applicants",
    travelerPlaceholder: "Applicants",
    submitLabel: "Check visa",
    formLabel: "Search visa support",
  },
  transfers: {
    whereLabel: "Pickup city",
    wherePlaceholder: "Select city",
    dateLabel: "Pickup date",
    travelerLabel: "Passengers",
    travelerPlaceholder: "Passengers",
    submitLabel: "Find transfer",
    formLabel: "Search transfers",
  },
  "car-rental": {
    whereLabel: "Pickup city",
    wherePlaceholder: "Select city",
    dateLabel: "Pickup date",
    travelerLabel: "Drivers",
    travelerPlaceholder: "Drivers",
    submitLabel: "Find cars",
    formLabel: "Search car rental",
  },
  insurance: {
    whereLabel: "Trip country",
    wherePlaceholder: "Select country",
    dateLabel: "Start date",
    travelerLabel: "Travelers",
    travelerPlaceholder: "Travelers",
    submitLabel: "Get cover",
    formLabel: "Search travel insurance",
  },
  cruise: {
    whereLabel: "Cruise region",
    wherePlaceholder: "Select region",
    dateLabel: "Sailing date",
    travelerLabel: "Guests",
    travelerPlaceholder: "Guests",
    submitLabel: "Plan cruise",
    formLabel: "Search cruises",
  },
  "customized-packages": {
    whereLabel: "Trip idea",
    wherePlaceholder: "Select destination",
    dateLabel: "Start date",
    travelerLabel: "Travelers",
    travelerPlaceholder: "Travelers",
    submitLabel: "Build trip",
    formLabel: "Search customized packages",
  },
  "assist-service": {
    whereLabel: "Support for",
    wherePlaceholder: "Select service city",
    dateLabel: "Travel date",
    travelerLabel: "Travelers",
    travelerPlaceholder: "Travelers",
    submitLabel: "Request assist",
    formLabel: "Search assist services",
  },
  "e-sim": {
    whereLabel: "Coverage",
    wherePlaceholder: "Select country",
    dateLabel: "Travel date (optional)",
    travelerLabel: "",
    travelerPlaceholder: "",
    submitLabel: "Find eSIM plans",
    formLabel: "Search e-SIM coverage",
  },
};

const packageLikeServices = new Set<SearchServiceKey>([
  "packages",
  "wellness",
  "hajj-umrah",
  "customized-packages",
]);

export function HeroSearch({
  destinations,
  initialService,
  moreLabel,
  serviceLabels,
}: HeroSearchProps) {
  const router = useRouter();
  const moreMenuRef = useRef<HTMLDetailsElement>(null);
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState("");
  const [selectedService, setSelectedService] =
    useState<SearchServiceKey>(initialService);
  const selectedCopy = serviceCopy[selectedService];
  const activeMoreService = useMemo(
    () => moreSearchServices.find((item) => item.service === selectedService),
    [selectedService],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedService === "hajj-umrah") {
      router.push("/hajj-umrah");
      return;
    }

    if (packageLikeServices.has(selectedService)) {
      const params = new URLSearchParams({ service: selectedService });
      const query = params.toString();

      router.push(
        destination ? `/trips/${destination}?${query}` : `/trips?${query}`,
      );
      return;
    }

    const params = new URLSearchParams({ service: selectedService });

    if (destination) {
      params.set("destination", destination);
    }

    router.push(`/?${params.toString()}#contact`);
  }

  function handleServiceSelect(service: SearchServiceKey) {
    setSelectedService(service);
    if (moreMenuRef.current) {
      moreMenuRef.current.open = false;
    }

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("service", service);
    url.hash = "travel-search";
    window.history.replaceState(null, "", url);
  }

  return (
    <section
      id="travel-search"
      className="mt-8 w-full scroll-mt-28 rounded-lg border border-white/22 bg-white/14 p-3 backdrop-blur-xl"
      aria-label="Travel search"
    >
      <div
        className="mb-3 flex flex-wrap gap-2"
        aria-label="Choose travel service"
      >
        {primarySearchServices.map((service) => (
          <ServiceButton
            key={service.service}
            label={serviceLabels[service.service] ?? service.label}
            service={service}
            isActive={selectedService === service.service}
            onSelect={handleServiceSelect}
          />
        ))}

        <details ref={moreMenuRef} className="group relative shrink-0">
          <summary
            className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border px-4 text-sm font-extrabold transition ${
              activeMoreService
                ? "border-brand-sand bg-brand-sand text-brand-navy"
                : "border-white/24 bg-white/12 text-white hover:bg-white/18"
            }`}
          >
            {activeMoreService ? (
              <TravelIcon icon={activeMoreService.icon} className="size-4" />
            ) : null}
            {activeMoreService
              ? (serviceLabels[activeMoreService.service] ??
                activeMoreService.label)
              : moreLabel}
            <span
              aria-hidden="true"
              className="mt-[-2px] size-1.5 rotate-45 border-b-2 border-r-2 border-current"
            />
          </summary>
          <div className="absolute left-0 top-12 z-20 grid min-w-60 gap-1 rounded-lg border border-white/20 bg-brand-navy/96 p-2 shadow-2xl backdrop-blur-xl">
            {moreSearchServices.map((service) => (
              <button
                key={service.service}
                type="button"
                onClick={() => handleServiceSelect(service.service)}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-bold transition ${
                  selectedService === service.service
                    ? "bg-brand-sand text-brand-navy"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <TravelIcon icon={service.icon} className="size-4" />
                {serviceLabels[service.service] ?? service.label}
              </button>
            ))}
          </div>
        </details>
      </div>

      {selectedService === "flight" ? (
        <HeroFlightSearch destinations={destinations} />
      ) : selectedService === "hotel" ? (
        <HeroHotelSearch />
      ) : selectedService === "packages" ? (
        <HeroPackagesSearch destinations={destinations} />
      ) : selectedService === "hajj-umrah" ? (
        <HeroHajjUmrahSearch destinations={destinations} />
      ) : selectedService === "transfers" ? (
        <HeroTransfersSearch destinations={destinations} />
      ) : selectedService === "e-sim" ? (
        <HeroEsimSearch />
      ) : (
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        aria-label={selectedCopy.formLabel}
      >
        <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <MapPinned aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              {selectedCopy.whereLabel}
            </span>
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className="block w-full appearance-none truncate bg-transparent text-sm font-extrabold outline-none"
            >
              <option value="">{selectedCopy.wherePlaceholder}</option>
              {destinations.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              {selectedCopy.dateLabel}
            </span>
            <input
              type="date"
              value={travelDate}
              onChange={(event) => setTravelDate(event.target.value)}
              className="block w-full bg-transparent text-sm font-extrabold outline-none"
              aria-label={selectedCopy.dateLabel}
            />
          </span>
        </label>

        <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <Users aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              {selectedCopy.travelerLabel}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={travelers}
              onChange={(event) => setTravelers(event.target.value)}
              placeholder={selectedCopy.travelerPlaceholder}
              className="block w-full bg-transparent text-sm font-extrabold outline-none placeholder:text-brand-blue/50"
              aria-label={selectedCopy.travelerLabel}
            />
          </span>
        </label>

        <button
          type="submit"
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
        >
          <Search aria-hidden="true" className="size-4" />
          {selectedCopy.submitLabel}
        </button>
      </form>
      )}
    </section>
  );
}

function ServiceButton({
  label,
  service,
  isActive,
  onSelect,
}: {
  label: string;
  service: HeroTab;
  isActive: boolean;
  onSelect: (service: SearchServiceKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service.service)}
      className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-extrabold transition ${
        isActive
          ? "border-brand-sand bg-brand-sand text-brand-navy"
          : "border-white/24 bg-white/12 text-white hover:bg-white/18"
      }`}
    >
      <TravelIcon icon={service.icon} className="size-4" />
      {label}
    </button>
  );
}
