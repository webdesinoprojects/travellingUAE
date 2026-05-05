export type NavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
};

export type TravelIconKey =
  | "flight"
  | "hotel"
  | "package"
  | "wellness"
  | "cruise"
  | "visa"
  | "bus"
  | "passport"
  | "document"
  | "insurance";

export type HeroTab = {
  label: string;
  icon: TravelIconKey;
};

export type ProductCard = {
  title: string;
  price: string;
  image: string;
  alt: string;
  action: string;
};

export type BentoPackage = {
  title: string;
  price: string;
  duration: string;
  image: string;
  alt: string;
  size: "featured" | "small" | "wide";
};

export type ServiceTile = {
  title: string;
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

export type FooterColumn = {
  title: string;
  links: string[];
};
