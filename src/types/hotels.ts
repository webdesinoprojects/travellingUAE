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
};

export type HotelDetailDTO = {
  searchId: string;
  hotel: Omit<HotelSearchCardDTO, "quoteId">;
  checkIn: string;
  checkOut: string;
  rooms: HotelGuestRoom[];
  rates: HotelRateDTO[];
  expiresAt: string;
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
