import type { TripDestination, TripPackage } from "@/types/travel";

const istanbulGallery = [
  {
    src: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=82",
    alt: "Istanbul mosque courtyard in warm daylight",
  },
  {
    src: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=800&q=82",
    alt: "Hot air balloons above Cappadocia",
  },
  {
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=82",
    alt: "Mountain town view during a holiday trip",
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=82",
    alt: "Green travel landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=82",
    alt: "Travelers exploring a scenic route",
  },
  {
    src: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=82",
    alt: "Holiday waterway scene",
  },
  {
    src: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=82",
    alt: "Flight above clouds",
  },
];

const bosniaGallery = [
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
    alt: "Large cultural landmark and city walkway",
  },
  {
    src: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=82",
    alt: "Historic building lit at night",
  },
  {
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=82",
    alt: "City valley surrounded by hills",
  },
  {
    src: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=82",
    alt: "Old city market lane with crafts",
  },
  {
    src: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=82",
    alt: "Historic square and wooden fountain",
  },
  {
    src: "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=800&q=82",
    alt: "City bridge and river view",
  },
  {
    src: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=800&q=82",
    alt: "Old town rooftops and skyline",
  },
];

const turkeyPackages: TripPackage[] = [
  {
    slug: "grand-eid-city-of-sultans",
    title: "A Grand Eid in the City of Sultans",
    city: "Istanbul",
    image:
      "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=82",
    alt: "Hagia Sophia and Turkish sweets during sunset",
    tags: ["Culture", "Eid Al Adha 2026"],
    categories: ["Culture", "Summer", "Eid Al Adha 2026"],
    badge: "Recommended",
    durationLabel: "4 Days",
    durationDays: 4,
    hasFlights: true,
    hotelStar: 4,
    priceAmount: 8738,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Experience the city adorned with lights, decorations, and a warm, celebratory vibe across markets, mosques, and public squares.",
      "Witness traditional Eid prayers, community gatherings, and the spirit of giving that defines this important holiday.",
      "Enjoy festive shopping deals at the Grand Bazaar and savor seasonal Turkish delicacies offered during the celebrations.",
    ],
    price: "SAR8,738",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "3 nights",
    overview:
      "Celebrate Eid with an unforgettable escape to Istanbul, where timeless heritage meets vibrant culture. Wander through charming old streets, explore lively bazaars, and discover the city's rich landmarks in a meaningful holiday experience.",
    highlights: [
      "Celebrate Eid in a city rich with Islamic heritage, beautiful mosques, and a warm festive atmosphere.",
      "Explore Istanbul's old town bazaars filled with local sweets, crafts, and traditional Eid delicacies.",
      "Experience the unique blend of Ottoman and European culture in a truly historic setting.",
    ],
    inclusions: [
      "Accommodation | In Istanbul",
      "Roundtrip Airport Transfers",
      "Flights (Optional)",
      "Activities (Optional)",
    ],
    exclusions: [
      "Visa",
      "Early check-in and late check-out charges",
      "Anything not mentioned in Inclusions",
      "Room Extras",
      "Additional Meals",
      "Personal Expenses",
    ],
    gallery: istanbulGallery,
  },
  {
    slug: "experience-turkey-with-pegasus-airlines",
    title: "Experience Turkey with Pegasus Airlines",
    city: "Istanbul",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=82",
    alt: "Passenger aircraft flying through clear blue sky",
    tags: ["Culture"],
    categories: ["Culture", "Summer"],
    badge: "Recommended",
    durationLabel: "4 Days",
    durationDays: 4,
    hasFlights: true,
    hotelStar: 3,
    priceAmount: 7420,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Enjoy roundtrip flights with Pegasus Airlines, offering a comfortable and budget-friendly journey to Istanbul.",
      "Stay in centrally located hotels that put you within easy reach of the city's major attractions, lively neighborhoods, and authentic eateries.",
      "Explore iconic landmarks like Hagia Sophia and the Blue Mosque in Istanbul.",
      "Private airport transfers ensure a smooth and hassle-free arrival and departure experience.",
    ],
    price: "SAR7,420",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "3 nights",
    overview:
      "Fly into Istanbul for a compact culture-led escape with reliable transfers, comfortable stays, and a thoughtful route through the city's best-loved landmarks.",
    highlights: [
      "Begin with easy roundtrip flights and private transfers.",
      "Visit the Blue Mosque, Hagia Sophia district, and heritage markets.",
      "Keep the trip flexible with optional activities and hotel upgrades.",
    ],
    inclusions: [
      "Accommodation | In Istanbul",
      "Roundtrip Airport Transfers",
      "Flights (Optional)",
      "Activities (Optional)",
    ],
    exclusions: [
      "Visa",
      "Personal expenses",
      "Room extras",
      "Meals not mentioned in itinerary",
    ],
    gallery: istanbulGallery,
  },
];

const bosniaPackages: TripPackage[] = [
  {
    slug: "celebrate-eid-in-bosnia",
    title: "Celebrate Eid In Bosnia",
    city: "Sarajevo",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
    alt: "Sarajevo inspired city escape with heritage architecture",
    tags: ["Culture", "Eid Al Adha 2026"],
    categories: ["Culture", "Nature", "Eid Al Adha 2026"],
    badge: "Recommended",
    durationLabel: "4 Days",
    durationDays: 4,
    hasFlights: true,
    hotelStar: 4,
    priceAmount: 8738,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Celebrate Eid in a city known for mosques, old bazaars, riverside walks, and welcoming local traditions.",
      "Discover Sarajevo's Ottoman and European character through a guided heritage route.",
      "Stay close to the old town with airport transfers and optional activities included.",
    ],
    price: "SAR8,738",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "3 nights",
    overview:
      "Celebrate Eid with an unforgettable escape to Sarajevo, where timeless history meets vibrant culture. Wander through charming old streets, explore lively bazaars, and discover the city's rich heritage, creating a festive and meaningful holiday experience.",
    highlights: [
      "Celebrate Eid in a city rich with Islamic heritage, beautiful mosques, and a warm festive atmosphere.",
      "Explore Sarajevo's old town bazaars filled with local sweets, crafts, and traditional Eid delicacies.",
      "Experience the unique blend of Ottoman and European culture in a truly historic setting.",
    ],
    inclusions: [
      "Accommodation | In Sarajevo",
      "Roundtrip Airport Transfers",
      "Flights (Optional)",
      "Activities (Optional)",
    ],
    exclusions: [
      "Visa",
      "Early check-in and late check-out charges",
      "Anything not mentioned in Inclusions",
      "Room Extras",
      "Additional Meals",
      "Personal Expenses",
    ],
    gallery: bosniaGallery,
  },
];

const switzerlandPackages: TripPackage[] = [
  {
    slug: "celebrate-eid-paris-switzerland",
    title: "Celebrate Eid : Paris & Switzerland",
    city: "Zurich",
    image:
      "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1200&q=82",
    alt: "Zurich riverside old town at dusk",
    tags: ["Culture", "Nature", "Eid Al Adha 2026"],
    categories: ["Culture", "Nature", "Eid Al Adha 2026"],
    badge: "Recommended",
    durationLabel: "6 Days",
    durationDays: 6,
    hasFlights: true,
    hotelStar: 4,
    priceAmount: 11890,
    features: [
      { label: "3 Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Enjoy Eid in Zurich's scenic beauty, charming old town, and serene lakeside views.",
      "Experience a perfect blend of culture, sightseeing, and festive celebrations across both cities.",
      "Celebrate Eid exploring romantic streets, iconic landmarks, and festive city views.",
    ],
    price: "SAR11,890",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "5 nights",
    overview:
      "A scenic Eid escape through Zurich and nearby alpine experiences with hand-picked hotels, transfers, and optional activities.",
    highlights: [
      "Explore Zurich's old town, lakeside promenade, and cultural landmarks.",
      "Enjoy a balanced city and nature itinerary with flexible activities.",
      "Stay in hand-picked hotels with easy access to key neighborhoods.",
    ],
    inclusions: [
      "Accommodation | In Zurich",
      "Roundtrip Airport Transfers",
      "Flights (Optional)",
      "Activities (Optional)",
    ],
    exclusions: [
      "Visa",
      "Personal expenses",
      "Room extras",
      "Meals not mentioned in itinerary",
    ],
    gallery: bosniaGallery,
  },
  {
    slug: "celebrate-eid-in-switzerland",
    title: "Celebrate Eid in Switzerland",
    city: "Lucerne",
    image:
      "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1200&q=82",
    alt: "Swiss alpine mountain view with flag",
    tags: ["Culture", "Nature", "Eid Al Adha 2026"],
    categories: ["Culture", "Nature", "Adventure", "Eid Al Adha 2026"],
    badge: "Recommended",
    durationLabel: "7 Days",
    durationDays: 7,
    hasFlights: true,
    hotelStar: 5,
    priceAmount: 12640,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Activities", icon: "activity" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
    ],
    bullets: [
      "Enjoy festive moments amidst elegant streets, cultural landmarks, and the historic Old Town during Eid.",
      "Celebrate Eid by the serene lakeside, iconic Chapel Bridge, and stunning alpine surroundings.",
      "Experience a peaceful Eid escape among charming alpine villages, waterfalls, and snow-capped peaks.",
    ],
    price: "SAR12,640",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "6 nights",
    overview:
      "Celebrate Eid across Switzerland with lakeside stays, alpine views, cultural walks, and optional activities.",
    highlights: [
      "Discover Lucerne's Chapel Bridge and lakefront atmosphere.",
      "Add mountain excursions and scenic rail journeys.",
      "Enjoy a relaxed holiday with hand-picked accommodation.",
    ],
    inclusions: [
      "Accommodation | In Lucerne",
      "Airport Transfers",
      "Flights (Optional)",
      "Activities (Optional)",
    ],
    exclusions: ["Visa", "Meals not listed", "Personal expenses", "Room extras"],
    gallery: bosniaGallery,
  },
  {
    slug: "interlaken-alpine-break",
    title: "Interlaken Alpine Break",
    city: "Interlaken",
    image:
      "https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&w=1200&q=82",
    alt: "Interlaken alpine lake and mountain landscape",
    tags: ["Nature", "Adventure"],
    categories: ["Nature", "Adventure", "Summer"],
    badge: "Popular",
    durationLabel: "5 Days",
    durationDays: 5,
    hasFlights: false,
    hotelStar: 4,
    priceAmount: 9340,
    features: [
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
      { label: "No Flights", icon: "flight" },
    ],
    bullets: [
      "Stay close to alpine trails, lakes, and cable-car routes.",
      "Choose optional adventure experiences based on your pace.",
      "Enjoy a clean land-only package with activity options that can be added when needed.",
    ],
    price: "SAR9,340",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "4 nights",
    overview:
      "A land-only Swiss alpine break with hand-picked stays, transfers, and optional adventure activities.",
    highlights: [
      "Explore Interlaken's alpine lakes and mountain viewpoints.",
      "Add paragliding, mountain rail, or waterfall excursions.",
      "Keep flights separate for flexible travel planning.",
    ],
    inclusions: ["Accommodation | In Interlaken", "Transfers", "Activities (Optional)"],
    exclusions: ["Flights", "Visa", "Meals not listed", "Personal expenses"],
    gallery: bosniaGallery,
  },
];

const thailandPackages: TripPackage[] = [
  {
    slug: "bangkok-phuket-summer",
    title: "Bangkok & Phuket Summer Escape",
    city: "Bangkok",
    image:
      "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=82",
    alt: "Bangkok skyline and river at sunset",
    tags: ["Culture", "Summer"],
    categories: ["Culture", "Summer"],
    badge: "Recommended",
    durationLabel: "6 Days",
    durationDays: 6,
    hasFlights: true,
    hotelStar: 4,
    priceAmount: 5990,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Explore Bangkok markets, temples, and riverfront neighborhoods.",
      "Continue to Phuket for beaches, island views, and relaxed evenings.",
      "Use optional activities to shape the itinerary around your travel pace.",
    ],
    price: "SAR5,990",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "5 nights",
    overview:
      "A Thailand city-and-beach package combining Bangkok culture with Phuket leisure.",
    highlights: [
      "Visit Bangkok's most popular cultural neighborhoods.",
      "Relax in Phuket with optional island activities.",
      "Stay in selected hotels with airport transfers.",
    ],
    inclusions: ["Accommodation", "Airport Transfers", "Flights (Optional)", "Activities (Optional)"],
    exclusions: ["Visa", "Personal expenses", "Meals not listed", "Room extras"],
    gallery: istanbulGallery,
  },
  {
    slug: "pattaya-family-break",
    title: "Pattaya Family Break",
    city: "Pattaya",
    image:
      "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=82",
    alt: "Thailand beach with longtail boats",
    tags: ["Beach", "Summer"],
    categories: ["Beach", "Summer"],
    badge: "Popular",
    durationLabel: "4 Days",
    durationDays: 4,
    hasFlights: false,
    hotelStar: 3,
    priceAmount: 3690,
    features: [
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
      { label: "No Flights", icon: "flight" },
    ],
    bullets: [
      "Enjoy a short coastal break with family-friendly hotel options.",
      "Add island tours, shows, or relaxed beach days.",
      "Keep flights optional for flexible departure cities.",
    ],
    price: "SAR3,690",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "3 nights",
    overview:
      "A flexible Pattaya stay with transfers, selected hotels, and optional activities.",
    highlights: [
      "Plan a compact beach-focused Thailand break.",
      "Add optional island and city experiences.",
      "Use land-only pricing when flights are not required.",
    ],
    inclusions: ["Accommodation | In Pattaya", "Transfers", "Activities (Optional)"],
    exclusions: ["Flights", "Visa", "Personal expenses", "Meals not listed"],
    gallery: istanbulGallery,
  },
  {
    slug: "phuket-island-holiday",
    title: "Phuket Island Holiday",
    city: "Phuket",
    image:
      "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?auto=format&fit=crop&w=1200&q=82",
    alt: "Phuket tropical island coastline",
    tags: ["Beach", "Nature", "Summer"],
    categories: ["Beach", "Nature", "Summer"],
    badge: "Recommended",
    durationLabel: "5 Days",
    durationDays: 5,
    hasFlights: true,
    hotelStar: 5,
    priceAmount: 6480,
    features: [
      { label: "Flights", icon: "flight" },
      { label: "Transfers", icon: "transfer" },
      { label: "Hand-Picked Hotels", icon: "hotel" },
      { label: "Activities", icon: "activity" },
    ],
    bullets: [
      "Stay near Phuket beaches with room to add island-hopping plans.",
      "Enjoy private transfers and flexible activity choices.",
      "Create a calm beach package with room for island tours and city experiences.",
    ],
    price: "SAR6,480",
    travelers: "2 adults",
    startDate: "27/05/2026",
    duration: "4 nights",
    overview:
      "A Phuket beach package with flights, transfers, hand-picked hotels, and optional activities.",
    highlights: [
      "Relax near Phuket beaches and island viewpoints.",
      "Add speedboat tours or city experiences.",
      "Use selected hotel and transfer inclusions for a smooth trip.",
    ],
    inclusions: ["Accommodation | In Phuket", "Airport Transfers", "Flights (Optional)", "Activities (Optional)"],
    exclusions: ["Visa", "Personal expenses", "Room extras", "Meals not listed"],
    gallery: istanbulGallery,
  },
];

const tripDestinations: TripDestination[] = [
  {
    slug: "turkey",
    name: "Turkey",
    resultTitle: "Trips in Turkey",
    resultCount: "Showing 1 - 14 of 14 Packages",
    packageDate: "27/05/2026",
    currency: "SAR",
    searchLabel: "Handpicked Holidays",
    poster: {
      title: "Turkey",
      price: "SAR 2,999",
      season: "Summer",
      image:
        "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=84",
      alt: "Hot air balloons over a Turkey holiday landscape",
    },
    categories: [
      { label: "Culture", count: 14 },
      { label: "Nature", count: 2 },
      { label: "Summer", count: 12 },
      { label: "Adventure", count: 3 },
      { label: "Beach", count: 3 },
      { label: "Eid Al Adha 2026", count: 1 },
    ],
    hotelStars: [
      { label: "3", count: 13 },
      { label: "4", count: 14 },
      { label: "5", count: 14 },
    ],
    packages: turkeyPackages,
  },
  {
    slug: "bosnia",
    name: "Bosnia",
    resultTitle: "Trips in Bosnia",
    resultCount: "Showing 1 - 6 of 6 Packages",
    packageDate: "27/05/2026",
    currency: "SAR",
    searchLabel: "Handpicked Holidays",
    poster: {
      title: "Bosnia",
      price: "SAR 3,499",
      season: "Eid",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=84",
      alt: "Bosnia inspired heritage travel landscape",
    },
    categories: [
      { label: "Culture", count: 6 },
      { label: "Nature", count: 2 },
      { label: "Summer", count: 4 },
      { label: "Adventure", count: 1 },
      { label: "Eid Al Adha 2026", count: 1 },
    ],
    hotelStars: [
      { label: "3", count: 4 },
      { label: "4", count: 6 },
      { label: "5", count: 2 },
    ],
    packages: bosniaPackages,
  },
  {
    slug: "switzerland",
    name: "Switzerland",
    resultTitle: "Trips in Switzerland",
    resultCount: "Showing 1 - 3 of 3 Packages",
    packageDate: "27/05/2026",
    currency: "SAR",
    searchLabel: "Handpicked Holidays",
    poster: {
      title: "Switzerland",
      price: "SAR 9,340",
      season: "Eid",
      image:
        "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=900&q=84",
      alt: "Switzerland lake and city travel landscape",
    },
    categories: [
      { label: "Culture", count: 2 },
      { label: "Nature", count: 3 },
      { label: "Summer", count: 1 },
      { label: "Adventure", count: 2 },
      { label: "Eid Al Adha 2026", count: 2 },
    ],
    hotelStars: [
      { label: "<3", count: 0 },
      { label: "3", count: 0 },
      { label: "4", count: 2 },
      { label: "5", count: 1 },
    ],
    packages: switzerlandPackages,
  },
  {
    slug: "thailand",
    name: "Thailand",
    resultTitle: "Trips in Thailand",
    resultCount: "Showing 1 - 3 of 3 Packages",
    packageDate: "27/05/2026",
    currency: "SAR",
    searchLabel: "Handpicked Holidays",
    poster: {
      title: "Thailand",
      price: "SAR 3,690",
      season: "Summer",
      image:
        "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=84",
      alt: "Thailand city and beach holiday landscape",
    },
    categories: [
      { label: "Culture", count: 1 },
      { label: "Nature", count: 1 },
      { label: "Summer", count: 3 },
      { label: "Adventure", count: 0 },
      { label: "Beach", count: 2 },
    ],
    hotelStars: [
      { label: "3", count: 1 },
      { label: "4", count: 1 },
      { label: "5", count: 1 },
    ],
    packages: thailandPackages,
  },
];

export async function getTripDestinations() {
  return tripDestinations;
}

export async function getTripDestination(slug: string) {
  return tripDestinations.find((destination) => destination.slug === slug);
}

export async function getTripPackage(
  destinationSlug: string,
  packageSlug: string,
) {
  const destination = await getTripDestination(destinationSlug);

  return destination?.packages.find(
    (pkg) => pkg.slug === packageSlug,
  );
}
