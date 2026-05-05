import type {
  BentoPackage,
  FooterColumn,
  HeroTab,
  NavItem,
  ProductCard,
  ServiceTile,
  Testimonial,
} from "@/types/travel";

export const navItems: NavItem[] = [
  { label: "Flight", href: "#flight" },
  { label: "Visas", href: "#visas", hasDropdown: true },
  { label: "Tour Packages", href: "#packages", hasDropdown: true },
  { label: "Wellness Packages", href: "#wellness" },
  { label: "Services", href: "#services", hasDropdown: true },
  { label: "Hajj & Umrah", href: "#hajj" },
  { label: "Blogs", href: "#blogs" },
];

export const heroTabs: HeroTab[] = [
  { label: "Flight", icon: "flight" },
  { label: "Hotels", icon: "hotel" },
  { label: "Tour Packages", icon: "package" },
  { label: "Wellness Packages", icon: "wellness" },
  { label: "Cruise", icon: "cruise" },
  { label: "Visas", icon: "visa" },
];

export const exclusives: ProductCard[] = [
  {
    title: "Best Wellness Packages",
    price: "INR 44,000",
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
    alt: "Wellness spa massage treatment in Kerala",
    action: "Enquire Now",
  },
  {
    title: "Kerala Packages",
    price: "INR 13,325",
    image:
      "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=80",
    alt: "Kerala backwaters with a houseboat and palm trees",
    action: "Book Now",
  },
  {
    title: "Affordable Air Tickets",
    price: "INR 16,799",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80",
    alt: "Passenger airplane wing above clouds",
    action: "Book Now",
  },
  {
    title: "Kashmir 5N/6D",
    price: "INR 16,500",
    image:
      "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80",
    alt: "Snowy Kashmir valley and lake",
    action: "Book Now",
  },
  {
    title: "Best Cruise Packages",
    price: "INR 33,990",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=900&q=80",
    alt: "Large cruise ship at sea",
    action: "Enquire Now",
  },
];

export const bentoPackages: BentoPackage[] = [
  {
    title: "Must Visit Nepal",
    price: "Starts INR 14,444",
    duration: "4 Nights / 5 Days",
    image:
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=82",
    alt: "Temple architecture in Nepal",
    size: "featured",
  },
  {
    title: "Viet Nam",
    price: "Starts INR 33,899",
    duration: "3 Nights / 4 Days",
    image:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=82",
    alt: "Boats in Ha Long Bay Vietnam",
    size: "small",
  },
  {
    title: "Malaysia",
    price: "Starts INR 27,666",
    duration: "3 Nights / 4 Days",
    image:
      "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=900&q=82",
    alt: "Kuala Lumpur skyline at dusk",
    size: "small",
  },
  {
    title: "China",
    price: "Starts INR 112,112",
    duration: "6 Nights / 7 Days",
    image:
      "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1400&q=82",
    alt: "Great Wall of China in warm evening light",
    size: "wide",
  },
];

export const services: ServiceTile[] = [
  {
    title: "Cruise",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=700&q=80",
    alt: "Cruise ship sailing during sunset",
    icon: "cruise",
  },
  {
    title: "Hotel Booking",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=700&q=80",
    alt: "Luxury hotel building",
    icon: "hotel",
  },
  {
    title: "Bus / Train Tickets",
    image:
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=700&q=80",
    alt: "Modern train platform",
    icon: "bus",
  },
  {
    title: "Passport services",
    image:
      "https://images.unsplash.com/photo-1542466500-dccb2789cbbb?auto=format&fit=crop&w=700&q=80",
    alt: "Passport and travel map",
    icon: "passport",
  },
  {
    title: "Document Attestation",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=700&q=80",
    alt: "Documents being signed at a desk",
    icon: "document",
  },
  {
    title: "Travel Insurance",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=700&q=80",
    alt: "Travel documents and insurance paperwork",
    icon: "insurance",
  },
];

export const testimonials: Testimonial[] = [
  {
    quote:
      "Smart Travel guided me and solved the visa issues in UAE. The team stayed clear, patient, and quick throughout.",
    author: "Muhammed Ashik",
  },
  {
    quote:
      "We had a great trip to Singapore planned by Smart Travel. Everything was well arranged and coordinated.",
    author: "Nekil Taji",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
    alt: "Travelers sitting together in a green park",
  },
  {
    quote:
      "We had an amazing trip to Nepal, all thanks to the excellent planning and support from Smart Travel.",
    author: "Arjun KS",
  },
  {
    quote:
      "Recently I went to Nepal on a Smart Holiday and had a really good experience. Everything was arranged well.",
    author: "Amritha K.S",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
    alt: "Couple looking at mountains during a trip",
  },
  {
    quote:
      "I would like to express my sincere appreciation for arranging my recent trip to Phuket, Thailand.",
    author: "Cedric Dsilva",
  },
  {
    quote:
      "I chose Smart Travel as my travel guide and it was a great service. The team made the whole plan easy.",
    author: "Rahul M R",
    image:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=700&q=80",
    alt: "Group of travelers standing in snowy mountains",
  },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Quick Links",
    links: ["About Us", "Work with us", "Contact Us"],
  },
  {
    title: "Services",
    links: [
      "India Tour Package",
      "International Tour Package",
      "Flight",
      "Global Visa",
      "Gulf Visa",
      "Hajj & Umrah",
      "Cruise",
      "Hotel Booking",
      "Bus & Train Tickets",
      "Passport Services",
      "Document Attestation",
      "Travel Insurance",
    ],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms & Conditions"],
  },
];
