export type AdminTripContentSource = "database" | "unconfigured";

export type AdminTripContentTrip = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
};

export type AdminTripTextItem = {
  id: string;
  body: string;
  sortOrder: number;
};

export type AdminTripInclusion = AdminTripTextItem;

export type AdminTripGalleryItem = {
  id: string;
  src: string;
  altText: string;
  sortOrder: number;
};

export type AdminTripItineraryItem = {
  id: string;
  title: string;
  body: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  zoom: number;
  sortOrder: number;
};

export type AdminTripContentWorkspace = {
  source: AdminTripContentSource;
  trips: AdminTripContentTrip[];
  selectedTripId: string | null;
  inclusions: AdminTripInclusion[];
  highlights: AdminTripTextItem[];
  exclusions: AdminTripTextItem[];
  terms: AdminTripTextItem[];
  gallery: AdminTripGalleryItem[];
  itinerary: AdminTripItineraryItem[];
};
