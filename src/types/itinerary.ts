export type ItinerarySegmentType =
  | "flight"
  | "transfer"
  | "hotel"
  | "activity"
  | "stay"
  | "note";

export type ItineraryOptionType = "flight" | "hotel" | "transfer" | "activity";

export type MoneyDelta = {
  currency: string;
  amount: number;
  label: string;
};

export type ItineraryPoint = {
  label?: string;
  code?: string;
  latitude?: number;
  longitude?: number;
};

export type ItinerarySegmentDTO = {
  id: string;
  type: ItinerarySegmentType;
  direction: "outbound" | "return" | "local";
  title: string;
  subtitle?: string;
  description?: string;
  dayOffset: number;
  dateLabel?: string;
  startTime?: string;
  endTime?: string;
  origin?: ItineraryPoint;
  destination?: ItineraryPoint;
  location?: ItineraryPoint;
  mapZoom: number;
  isRequired: boolean;
  isChangeable: boolean;
  selectedOption?: SegmentOptionDTO;
};

export type FlightOptionDTO = {
  id: string;
  type: "flight";
  title: string;
  airlineName: string;
  airlineCode?: string;
  airlineLogoUrl?: string;
  flightNumber?: string;
  origin: ItineraryPoint;
  destination: ItineraryPoint;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes?: number;
  stopsCount: number;
  layoverAirports: string[];
  cabin?: string;
  fareClass?: string;
  baggageLabel?: string;
  priceDelta: MoneyDelta;
  isDefault: boolean;
};

export type HotelOptionDTO = {
  id: string;
  type: "hotel";
  hotelName: string;
  address?: string;
  starRating?: number;
  roomName?: string;
  boardBasis?: string;
  checkInDayOffset: number;
  checkOutDayOffset: number;
  nights: number;
  imageUrl?: string;
  guestRating?: number;
  amenities: string[];
  location?: ItineraryPoint;
  priceDelta: MoneyDelta;
  isDefault: boolean;
  /** True when this option is a live provider (RateHawk) quote. */
  isLive?: boolean;
};

export type TransferOptionDTO = {
  id: string;
  type: "transfer";
  title: string;
  pickupLabel: string;
  dropoffLabel: string;
  vehicleType: string;
  vehicleImageUrl?: string;
  luggageCount?: number;
  paxMin: number;
  paxMax: number;
  durationMinutes?: number;
  priceDelta: MoneyDelta;
  isDefault: boolean;
};

export type ActivityOptionDTO = {
  id: string;
  type: "activity";
  title: string;
  description?: string;
  category?: string;
  dayOffset: number;
  durationMinutes?: number;
  pickupIncluded: boolean;
  imageUrl?: string;
  location?: ItineraryPoint;
  priceDelta: MoneyDelta;
  isDefault: boolean;
};

export type SegmentOptionDTO =
  | FlightOptionDTO
  | HotelOptionDTO
  | TransferOptionDTO
  | ActivityOptionDTO;

export type TripItineraryDTO = {
  trip: {
    id: string;
    slug: string;
    title: string;
    currency: string;
    startDate?: string;
  };
  destination: {
    slug: string;
    name: string;
  };
  segments: ItinerarySegmentDTO[];
  summaryTimeline: Array<{
    segmentId: string;
    type: ItinerarySegmentType;
    title: string;
    dateLabel?: string;
    selectedLabel?: string;
  }>;
};

export type SegmentOptionsDTO = {
  segment: ItinerarySegmentDTO;
  options: SegmentOptionDTO[];
  total: number;
  filters: Record<string, string | string[] | number | boolean | undefined>;
};

export type SelectionResultDTO = {
  selected: SegmentOptionDTO;
  totalDelta: MoneyDelta;
  expiresAt: string;
};

export type CheckoutLineItem = {
  segmentId: string;
  segmentTitle: string;
  type: ItinerarySegmentType;
  optionLabel: string;
  priceDelta: MoneyDelta;
  cancellationSummary?: string | null;
  boardBasis?: string | null;
  nights?: number | null;
};

export type CheckoutSummaryDTO = {
  trip: {
    id: string;
    title: string;
    destinationSlug: string;
    destinationName: string;
    startDate?: string;
    currency: string;
  };
  selections: CheckoutLineItem[];
  travelDate?: string;
  travelersCount: number;
  totalDelta: MoneyDelta;
  expiresAt: string;
};

export type PrebookStatus = "confirmed" | "price_changed" | "unavailable";

export type PrebookResultDTO = {
  status: PrebookStatus;
  optionId: string;
  /** Internal UUID of the stored prebook snapshot - for checkout (HP-4). Never the prebook_hash. */
  prebookId: string | null;
  priceChanged: boolean;
  oldPrice: MoneyDelta;
  newPrice: MoneyDelta;
  /** Human-readable cancellation summary, e.g. "Free cancellation until 20 Jun 2026". */
  cancellationSummary: string | null;
  expiresAt: string;
};
