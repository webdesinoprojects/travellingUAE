export type HajjUmrahHeroImage = {
  url: string;
  alt: string;
};

export type HajjUmrahPageContent = {
  heroImageUrl: string;
  heroImageAlt: string;
  heroImages: HajjUmrahHeroImage[];
  heroTitle: string;
  breadcrumbLabel: string;
  pageHeading: string;
  contentMarkdown: string;
  introParagraphs: string[];
  benefits: string[];
  closingCtaText: string;
  formTitle: string;
  formIntro: string;
  seoTitle: string;
  seoDescription: string;
};

export type AdminHajjUmrahPageContent = HajjUmrahPageContent & {
  source: "database" | "fallback" | "unconfigured";
  updatedAt?: string | null;
};
