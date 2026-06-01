import type {
  BentoPackage,
  ProductCard,
  ServiceTile,
  Testimonial,
  TravelIconKey,
} from "@/types/travel";

export type PublicHeroMedia = {
  backgroundImage: string;
  backgroundAlt: string;
};

export type AdminHomeHero = PublicHeroMedia & {
  id?: string;
  status: "draft" | "published" | "archived";
  updatedAt?: string;
  source: "fallback" | "database";
};

export type PublicHomeSectionCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

export type PublicHomeContent = {
  hero: PublicHeroMedia;
  picksSection: PublicHomeSectionCopy;
  routesSection: PublicHomeSectionCopy;
  exclusives: ProductCard[];
  bentoPackages: BentoPackage[];
  services: ServiceTile[];
  testimonials: Testimonial[];
};

export type AdminContentStatus = "draft" | "published" | "archived";

export type AdminHomeMediaOption = {
  id: string;
  label: string;
  imageUrl: string;
  imageAlt: string;
};

export type AdminHomeCollection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  type: "flytime_picks" | "route_board";
  status: AdminContentStatus;
  sortOrder: number;
};

export type AdminHomeCollectionItem = {
  id: string;
  collectionId: string;
  collectionType: AdminHomeCollection["type"];
  title: string;
  subtitle: string;
  priceLabel: string;
  durationLabel: string;
  actionLabel: string;
  href: string;
  mediaId: string;
  status: AdminContentStatus;
  sortOrder: number;
  layout: "featured" | "wide" | "small";
};

export type AdminHomeService = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  icon: TravelIconKey;
  mediaId: string;
  status: AdminContentStatus;
  sortOrder: number;
};

export type AdminHomeTestimonial = {
  id: string;
  author: string;
  quote: string;
  mediaId: string;
  status: AdminContentStatus;
  sortOrder: number;
};

export type AdminHomeContent = {
  source: "database" | "unconfigured";
  collections: AdminHomeCollection[];
  items: AdminHomeCollectionItem[];
  services: AdminHomeService[];
  testimonials: AdminHomeTestimonial[];
  media: AdminHomeMediaOption[];
};
