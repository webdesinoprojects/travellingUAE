export type NavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
  children?: NavItem[];
};

export type TravelIconKey =
  | "flight"
  | "hotel"
  | "package"
  | "hajj"
  | "wellness"
  | "cruise"
  | "visa"
  | "bus"
  | "transfer"
  | "car"
  | "passport"
  | "document"
  | "insurance"
  | "sim";

export type SearchServiceKey =
  | "flight"
  | "hotel"
  | "packages"
  | "hajj-umrah"
  | "wellness"
  | "visa"
  | "transfers"
  | "car-rental"
  | "insurance"
  | "cruise"
  | "customized-packages"
  | "assist-service"
  | "e-sim";

export type HeroTab = {
  label: string;
  icon: TravelIconKey;
  service: SearchServiceKey;
};

export type ProductCard = {
  title: string;
  price: string;
  summary?: string;
  image: string;
  alt: string;
  action: string;
  href?: string;
};

export type BentoPackage = {
  title: string;
  price: string;
  duration: string;
  image: string;
  alt: string;
  size: "featured" | "small" | "wide";
  href?: string;
};

export type ServiceTile = {
  title: string;
  summary?: string;
  image: string;
  alt: string;
  icon: TravelIconKey;
};

export type Testimonial = {
  quote: string;
  author: string;
  image?: string;
  alt?: string;
};

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterColumn = {
  title: string;
  links: FooterLink[];
};

export type TripCategory = {
  label: string;
  count: number;
};

export type TripFeature = {
  label: string;
  icon: "flight" | "transfer" | "hotel" | "activity";
};

export type TripGalleryImage = {
  src: string;
  alt: string;
};

export type TripMapLocation = {
  label: string;
  latitude: number;
  longitude: number;
  zoom: number;
};

export type TripItinerary = {
  title: string;
  paragraphs: string[];
  days: Array<{
    title: string;
    description: string;
  }>;
};

export type TripPackage = {
  slug: string;
  title: string;
  city: string;
  image: string;
  alt: string;
  tags: string[];
  categories: string[];
  badge: string;
  durationLabel: string;
  durationDays: number;
  hasFlights: boolean;
  hotelStar: number;
  priceAmount: number;
  features: TripFeature[];
  bullets: string[];
  price: string;
  travelers: string;
  startDate: string;
  duration: string;
  overview: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  gallery: TripGalleryImage[];
  mapLocation?: TripMapLocation;
  itinerary?: TripItinerary;
  terms?: string[];
};

export type TripDestination = {
  slug: string;
  name: string;
  resultTitle: string;
  resultCount: string;
  packageDate: string;
  currency: string;
  searchLabel: string;
  poster: {
    title: string;
    price: string;
    season: string;
    image: string;
    alt: string;
  };
  categories: TripCategory[];
  hotelStars: TripCategory[];
  packages: TripPackage[];
};
