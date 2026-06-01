export type VisaTypeOption = {
  title: string;
  processingTime: string;
  stayPeriod: string;
  validity: string;
  entry: string;
  fee: string;
  popular?: boolean;
};

export type VisaDocumentGroup = {
  title: string;
  items: string[];
};

export type VisaProcessStep = {
  title: string;
  description: string;
};

export type VisaFaq = {
  question: string;
  answer: string;
};

export type VisaDestination = {
  slug: string;
  name: string;
  countryCode: string;
  stayLabel: string;
  processingLabel: string;
  priceLabel: string;
  image: string;
  alt: string;
  detailTitle: string;
  approvalText: string;
  processingTime: string;
  startingFrom: string;
  agentBadge: string;
  overview: string[];
  visaTypes: VisaTypeOption[];
  documents: VisaDocumentGroup[];
  processSteps: VisaProcessStep[];
  whyChooseUs: string[];
  faqs: VisaFaq[];
  embassyNote: string;
  visitUsNote: string;
};

export type VisaPageContent = {
  slug: "gulf-visa" | "global-visa";
  breadcrumbLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroAlt: string;
  destinationsTitle: string;
  destinations: VisaDestination[];
};

type VisaDestinationInput = Omit<
  VisaDestination,
  | "detailTitle"
  | "approvalText"
  | "processingTime"
  | "startingFrom"
  | "agentBadge"
  | "overview"
  | "visaTypes"
  | "documents"
  | "processSteps"
  | "whyChooseUs"
  | "faqs"
  | "embassyNote"
  | "visitUsNote"
> &
  Partial<
    Pick<
      VisaDestination,
      | "detailTitle"
      | "approvalText"
      | "processingTime"
      | "startingFrom"
      | "agentBadge"
      | "overview"
      | "visaTypes"
      | "documents"
      | "processSteps"
      | "whyChooseUs"
      | "faqs"
      | "embassyNote"
      | "visitUsNote"
    >
  >;

const visaHeroImage =
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=2400&q=84";

const dubaiVisaTypes: VisaTypeOption[] = [
  {
    title: "48 Hours Transit Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "2 days",
    validity: "30 days",
    entry: "Single",
    fee: "INR 3,499/-",
  },
  {
    title: "30 Days Tourist Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "30 days",
    validity: "58 days",
    entry: "Single",
    fee: "INR 7,899/-",
    popular: true,
  },
  {
    title: "30 Days Family Tourist Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "30 days",
    validity: "58 days",
    entry: "Single",
    fee: "INR 19,999/-",
    popular: true,
  },
  {
    title: "96 Hours Transit Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "4 days",
    validity: "30 days",
    entry: "Single",
    fee: "INR 5,299/-",
  },
  {
    title: "14 Days Tourist Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "14 days",
    validity: "58 days",
    entry: "Single",
    fee: "INR 7,699/-",
  },
  {
    title: "30 Days Tourist Visa Express",
    processingTime: "Upto 48 hours",
    stayPeriod: "30 days",
    validity: "58 days",
    entry: "Single",
    fee: "INR 8,999/-",
  },
  {
    title: "60 Days Tourist Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "60 days",
    validity: "58 days",
    entry: "Single",
    fee: "INR 13,999/-",
  },
  {
    title: "30 Days Multiple Entry Tourist Visa",
    processingTime: "Upto 5 days",
    stayPeriod: "30 days",
    validity: "58 days",
    entry: "Multiple",
    fee: "INR 17,999/-",
  },
];

function createDestination(input: VisaDestinationInput): VisaDestination {
  const price = input.priceLabel.replace(/\s*onwards$/i, "");
  const baseVisaTypes =
    input.slug === "dubai"
      ? dubaiVisaTypes
      : buildDefaultVisaTypes(input.name, input.processingLabel, price);

  return {
    ...input,
    detailTitle:
      input.detailTitle ?? `${input.name} Visa Online for Travellers`,
    approvalText:
      input.approvalText ??
      `99.2% ${input.name} visas prepared before committed timelines`,
    processingTime: input.processingTime ?? input.processingLabel,
    startingFrom: input.startingFrom ?? price,
    agentBadge:
      input.agentBadge ??
      `Authorised visa assistance desk for ${input.name} travel`,
    overview:
      input.overview ??
      buildOverview(input.name, input.processingLabel, input.priceLabel),
    visaTypes: input.visaTypes ?? baseVisaTypes,
    documents: input.documents ?? buildDocuments(input.name),
    processSteps: input.processSteps ?? buildProcessSteps(input.name),
    whyChooseUs: input.whyChooseUs ?? buildWhyChooseUs(input.name),
    faqs: input.faqs ?? buildFaqs(input.name, input.processingLabel),
    embassyNote:
      input.embassyNote ??
      `${input.name} embassy and consulate guidance will be confirmed by the Fly Time visa desk based on nationality, residence status, and chosen visa type.`,
    visitUsNote:
      input.visitUsNote ??
      "Visit the Fly Time office or submit your details online. The visa team will confirm the document checklist before collecting any application material.",
  };
}

function buildDefaultVisaTypes(
  destinationName: string,
  processingTime: string,
  price: string,
): VisaTypeOption[] {
  return [
    {
      title: `${destinationName} Tourist Visa`,
      processingTime,
      stayPeriod: "30 days",
      validity: "As approved",
      entry: "Single",
      fee: price,
      popular: true,
    },
    {
      title: `${destinationName} Express Visa`,
      processingTime: "Priority review available",
      stayPeriod: "Short stay",
      validity: "As approved",
      entry: "Single",
      fee: "On request",
    },
    {
      title: `${destinationName} Family Visa`,
      processingTime,
      stayPeriod: "30 days",
      validity: "As approved",
      entry: "Single",
      fee: "On request",
    },
  ];
}

function buildOverview(
  destinationName: string,
  processingTime: string,
  priceLabel: string,
) {
  return [
    `Fly Time helps prepare ${destinationName} visa applications with document checks, guidance, and clear follow-up from the visa desk.`,
    `Most travellers choose this service for predictable processing, transparent pricing from ${priceLabel}, and support before submission.`,
    `Final eligibility, documents, and visa validity depend on nationality, residence status, travel dates, and the authority handling the application.`,
  ];
}

function buildDocuments(destinationName: string): VisaDocumentGroup[] {
  return [
    {
      title: `Must-have documents for ${destinationName} visa`,
      items: [
        "Scanned colour copy of valid passport first and last page",
        "Recent passport-size photograph with plain background",
        "Confirmed return flight or expected travel itinerary",
        "Hotel booking or stay address where required",
      ],
    },
    {
      title: "Additional documents may be requested",
      items: [
        "Residence permit or visa copy for current country of stay",
        "Bank statement, employment proof, or sponsor letter if required",
        "Previous travel history where the destination authority asks for it",
      ],
    },
  ];
}

function buildProcessSteps(destinationName: string): VisaProcessStep[] {
  return [
    {
      title: "Choose visa type",
      description: `Select the ${destinationName} visa option that matches your trip length, entry type, and travel purpose.`,
    },
    {
      title: "Submit documents",
      description:
        "Share clear document scans through the confirmed support channel after the visa desk verifies your checklist.",
    },
    {
      title: "Application review",
      description:
        "Fly Time reviews the file, flags missing details, and submits the application after approval from the applicant.",
    },
    {
      title: "Receive visa update",
      description: `The ${destinationName} visa status and copy are shared through email or WhatsApp once issued by the authority.`,
    },
  ];
}

function buildWhyChooseUs(destinationName: string): string[] {
  return [
    `Destination-specific ${destinationName} visa checklist before submission`,
    "Clear service pricing and processing expectations",
    "Human follow-up from the visa desk instead of unattended forms",
    "Support for family, group, and repeat traveller enquiries",
  ];
}

function buildFaqs(
  destinationName: string,
  processingTime: string,
): VisaFaq[] {
  return [
    {
      question: `How long does a ${destinationName} visa take?`,
      answer: `Typical processing is ${processingTime}. The final timeline depends on document quality, nationality, residence status, and authority workload.`,
    },
    {
      question: `Can Fly Time guarantee ${destinationName} visa approval?`,
      answer:
        "No travel desk can guarantee approval. Fly Time checks documents and helps reduce avoidable submission errors, but the final decision is made by the visa authority.",
    },
    {
      question: "Can I apply before booking flights?",
      answer:
        "Some visa types allow tentative travel plans while others require confirmed tickets or hotel proof. The visa desk will confirm the requirement before submission.",
    },
  ];
}

export const gulfVisaPage: VisaPageContent = {
  slug: "gulf-visa",
  breadcrumbLabel: "Gulf Visa Services",
  heroTitle: "Gulf Visa Services",
  heroSubtitle:
    "Experience stress-free GCC travel support with clear visa guidance for every destination, every time.",
  heroImage: visaHeroImage,
  heroAlt: "Modern Gulf city skyline under a clear blue sky",
  destinationsTitle: "Popular Visa Destinations",
  destinations: [
    createDestination({
      slug: "bahrain",
      name: "Bahrain",
      countryCode: "BH",
      stayLabel: "14 days",
      processingLabel: "2-3 Business Days",
      priceLabel: "INR 4000 onwards",
      image:
        "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1000&q=82",
      alt: "Bahrain waterfront skyline at dusk",
    }),
    createDestination({
      slug: "dubai",
      name: "Dubai",
      countryCode: "AE",
      stayLabel: "30 Days",
      processingLabel: "2-3 Business Days",
      priceLabel: "INR 7800 onwards",
      image:
        "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=82",
      alt: "Dubai skyline with modern towers and city roads",
      detailTitle: "Dubai Visa Online for Indians",
      approvalText: "99.2% visas approved before time",
      processingTime: "Up to 48 hours",
      startingFrom: "INR 3,499/-",
      agentBadge:
        "Authorised visa agent support for UAE government visa applications",
      overview: [
        "Apply for Dubai tourist, transit, family, and multiple-entry visa support with guided document checks from the Fly Time visa desk.",
        "The team confirms the right visa category, reviews scans before submission, and keeps applicants updated through the process.",
        "Final approval, validity, and processing timelines remain subject to UAE immigration rules and applicant eligibility.",
      ],
      documents: [
        {
          title: "Must-have documents for Dubai entry visa",
          items: [
            "Scanned colour copy of first and last page of valid passport",
            "Passport-size photograph with white background",
            "Confirmed return flight tickets or tentative travel plan",
            "Hotel booking details or UAE stay address",
          ],
        },
      ],
      faqs: [
        {
          question: "How much does a Dubai visa cost?",
          answer:
            "Dubai visa pricing starts from INR 3,499/- for listed demo options. Final pricing depends on visa type, urgency, nationality, and current authority fees.",
        },
        {
          question: "Is a Dubai visa free for Indians?",
          answer:
            "Most Indian passport holders need an eligible visa or entry permit unless they qualify under a specific exemption. The visa desk will confirm eligibility before submission.",
        },
        {
          question: "Can I get a Dubai visa urgently?",
          answer:
            "Express handling can be requested for eligible cases. Final timing depends on document quality and immigration processing.",
        },
      ],
    }),
    createDestination({
      slug: "kuwait",
      name: "Kuwait",
      countryCode: "KW",
      stayLabel: "30 days",
      processingLabel: "2-4 Business Days",
      priceLabel: "INR 3500 onwards",
      image:
        "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1000&q=82",
      alt: "Middle East city skyline near the water",
      detailTitle: "Kuwait Visa Online Support",
    }),
    createDestination({
      slug: "oman",
      name: "Oman",
      countryCode: "OM",
      stayLabel: "10 days",
      processingLabel: "3-4 Business Days",
      priceLabel: "INR 2550 onwards",
      image:
        "https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=1000&q=82",
      alt: "Oman coastline and mountain scenery",
    }),
    createDestination({
      slug: "qatar",
      name: "Qatar",
      countryCode: "QA",
      stayLabel: "30 days",
      processingLabel: "3-4 Business Days",
      priceLabel: "INR 1400 onwards",
      image:
        "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=1000&q=82",
      alt: "Doha skyline at sunset",
    }),
    createDestination({
      slug: "saudi",
      name: "Saudi",
      countryCode: "SA",
      stayLabel: "30 days",
      processingLabel: "15-25 Business Days",
      priceLabel: "INR 15900 onwards",
      image:
        "https://images.unsplash.com/photo-1565552645632-d725f8bfc19a?auto=format&fit=crop&w=1000&q=82",
      alt: "Saudi city towers lit at evening",
      detailTitle: "Saudi Visa Online Support",
    }),
  ],
};

export const globalVisaPage: VisaPageContent = {
  slug: "global-visa",
  breadcrumbLabel: "Global Visa Services",
  heroTitle: "Global Visa Services",
  heroSubtitle:
    "Visa support for worldwide travel plans with document checks, guidance, and clear follow-up from the Fly Time desk.",
  heroImage: visaHeroImage,
  heroAlt: "World landmarks and travel skyline under a blue sky",
  destinationsTitle: "Popular Visa Destinations",
  destinations: [
    createDestination({
      slug: "armenia",
      name: "Armenia",
      countryCode: "AM",
      stayLabel: "21 days",
      processingLabel: "3-5 Business Days",
      priceLabel: "INR 1600 onwards",
      image:
        "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=82",
      alt: "Mountain lake and monastery landscape",
    }),
    createDestination({
      slug: "azerbaijan",
      name: "Azerbaijan",
      countryCode: "AZ",
      stayLabel: "30 days",
      processingLabel: "5 Business Days",
      priceLabel: "INR 4200 onwards",
      image:
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1000&q=82",
      alt: "City architecture and waterfront promenade",
    }),
    ...gulfVisaPage.destinations,
    createDestination({
      slug: "malaysia",
      name: "Malaysia",
      countryCode: "MY",
      stayLabel: "30 days",
      processingLabel: "4-6 Business Days",
      priceLabel: "INR 6200 onwards",
      image:
        "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=1000&q=82",
      alt: "Kuala Lumpur skyline during sunset",
    }),
    createDestination({
      slug: "singapore",
      name: "Singapore",
      countryCode: "SG",
      stayLabel: "30 days",
      processingLabel: "5-7 Business Days",
      priceLabel: "INR 5400 onwards",
      image:
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=82",
      alt: "Singapore city skyline and waterfront",
    }),
    createDestination({
      slug: "thailand",
      name: "Thailand",
      countryCode: "TH",
      stayLabel: "60 days",
      processingLabel: "4-6 Business Days",
      priceLabel: "INR 5200 onwards",
      image:
        "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1000&q=82",
      alt: "Thailand coastal resort and blue sea",
      detailTitle: "Thailand Visa Online Support",
      processSteps: [
        {
          title: "Submit documents online",
          description:
            "Share your passport scan, photo, stay plan, and nationality details with the visa desk.",
        },
        {
          title: "Make payment securely",
          description:
            "Confirm the quoted fee after the checklist and visa type are approved.",
        },
        {
          title: "Receive Thailand visa by email",
          description:
            "The team shares the issued visa or status update after authority processing.",
        },
      ],
    }),
    createDestination({
      slug: "turkey",
      name: "Turkey",
      countryCode: "TR",
      stayLabel: "30 days",
      processingLabel: "3-5 Business Days",
      priceLabel: "INR 4100 onwards",
      image:
        "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1000&q=82",
      alt: "Turkey city and hot air balloons",
    }),
    createDestination({
      slug: "united-kingdom",
      name: "United Kingdom",
      countryCode: "UK",
      stayLabel: "180 days",
      processingLabel: "15-30 Business Days",
      priceLabel: "INR 12500 onwards",
      image:
        "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1000&q=82",
      alt: "London city landmarks near the river",
    }),
    createDestination({
      slug: "united-states",
      name: "United States",
      countryCode: "US",
      stayLabel: "As approved",
      processingLabel: "Appointment Based",
      priceLabel: "INR 18500 onwards",
      image:
        "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1000&q=82",
      alt: "United States bridge and skyline",
    }),
    createDestination({
      slug: "vietnam",
      name: "Vietnam",
      countryCode: "VN",
      stayLabel: "30 days",
      processingLabel: "3-5 Business Days",
      priceLabel: "INR 3500 onwards",
      image:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=82",
      alt: "Vietnam bay with boats and mountains",
    }),
  ],
};

export const visaPages = [gulfVisaPage, globalVisaPage] as const;

export function getVisaPage(slug: string) {
  return visaPages.find((page) => page.slug === slug);
}

export function getVisaDestination(pageSlug: string, visaSlug: string) {
  const page = getVisaPage(pageSlug);

  if (!page) {
    return null;
  }

  const destination = page.destinations.find(
    (item) => item.slug === visaSlug,
  );

  if (!destination) {
    return null;
  }

  return { page, destination };
}
