import type { CheckoutGuestRoom } from "./itinerary";

export type HotelGuestRoom = {
  adults: number;
  children: number[];
};

export type HotelSearchInput = {
  destinationSlug?: string;
  providerRegionId?: number;
  destinationName?: string;
  destinationCountryCode?: string | null;
  selectedHotelId?: string | null;
  selectedHid?: number | null;
  checkIn: string;
  checkOut: string;
  residency: string;
  rooms: HotelGuestRoom[];
  currency?: string;
  language?: string;
};

export type HotelDestinationSuggestion = {
  regionId: number;
  name: string;
  countryCode: string | null;
  type: string;
  hotelId?: string | null;
  hid?: number | null;
};

export type HotelSearchCardDTO = {
  quoteId: string;
  hotelId: string;
  name: string;
  address: string | null;
  imageUrl: string | null;
  starRating: number | null;
  roomName: string | null;
  boardBasis: string | null;
  priceAmount: number;
  currency: string;
  nights: number;
};

export type HotelSearchResultDTO = {
  searchId: string;
  destination: { slug: string; name: string };
  checkIn: string;
  checkOut: string;
  rooms: HotelGuestRoom[];
  residency: string;
  expiresAt: string;
  hotels: HotelSearchCardDTO[];
};

export type HotelRateDTO = {
  rateId: string;
  roomName: string | null;
  boardBasis: string | null;
  priceAmount: number;
  currency: string;
  roomGroupName: string | null;
  roomImages: string[];
  roomPhotoCount: number;
  bedType: string | null;
  beds: string[];
  roomSizeSqm: number | null;
  amenities: string[];
  smokingLabel: string | null;
  hasBathroom: boolean;
  capacity: number | null;
  allotment: number | null;
  cancellationFreeBefore: string | null;
  cancellationPolicyCount: number;
  paymentType: string | null;
};

export type HotelStaticRoomGroupDTO = {
  id: string | null;
  name: string | null;
  mainName: string | null;
  mainRoomType: string | null;
  images: string[];
  amenities: string[];
  rgExt: Record<string, number | string | boolean | null>;
  bedType: string | null;
  beds: string[];
  roomSizeSqm: number | null;
  smokingLabel: string | null;
  hasBathroom: boolean | null;
  capacity: number | null;
};

export type HotelPolicyInfo = {
  checkInTime: string | null;
  checkOutTime: string | null;
  extraInfo: string | null;
};

/** One "paid on the spot" charge parsed from metapolicy_struct (real data only). */
export type HotelPaidOnSpotItem = {
  /** e.g. "Deposit", "Parking", "Pets", "Meals". */
  label: string;
  /** Human-readable amount, e.g. "500.00 RUB per car per night". */
  amount: string;
  /** Short note, e.g. "Paid on site" / "Included". */
  note: string | null;
};

/**
 * Sanitized static hotel content from provider_hotel_content. Every field is
 * optional/empty when the provider did not supply it (lean rows), so the UI
 * falls back gracefully and never renders invented data.
 */
export type HotelStaticContentDTO = {
  images: string[];
  roomGroups: HotelStaticRoomGroupDTO[];
  amenities: string[];
  description: string | null;
  policies: HotelPolicyInfo | null;
  paidOnSpot: HotelPaidOnSpotItem[];
  starRating: number | null;
  address: string | null;
  regionName: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type HotelDetailDTO = {
  searchId: string;
  hotel: Omit<HotelSearchCardDTO, "quoteId">;
  checkIn: string;
  checkOut: string;
  rooms: HotelGuestRoom[];
  rates: HotelRateDTO[];
  expiresAt: string;
  /** Rich static content when available; null for lean/unsynced hotels. */
  staticContent: HotelStaticContentDTO | null;
};

export type StandaloneHotelCheckoutSummaryDTO = {
  checkoutId: string;
  status:
    | "form_created"
    | "unsupported_payment"
    | "payment_pending"
    | "finish_started"
    | "processing"
    | "confirmed"
    | "failed"
    | "pending_review"
    | "expired";
  hotel: {
    id: string;
    name: string;
    roomName: string | null;
    boardBasis: string | null;
  };
  checkIn: string;
  checkOut: string;
  residency: string;
  rooms: CheckoutGuestRoom[];
  price: { amount: number; currency: string };
  originalPrice: { amount: number; currency: string } | null;
  priceChanged: boolean;
  cancellationSummary: string | null;
  cancellationFreeBefore: string | null;
  payment:
    | { mode: "deposit"; amount: string; currencyCode: string }
    | {
        mode: "now";
        amount: string;
        currencyCode: string;
        isNeedCreditCardData: boolean;
        isNeedCvc: boolean;
      }
    | { mode: "unsupported"; reason: string; returnedTypes: string[] };
  isGenderSpecificationRequired: boolean;
};
