export type SocialPlatform = "facebook" | "youtube" | "instagram" | "linkedin";

export type PublicFooterSocialLink = {
  platform: SocialPlatform;
  label: string;
  href: string;
};

export type PublicFooterContact = {
  tagline: string;
  address: string;
  phone: string;
  email: string;
};

export type PublicFooterSettings = {
  contact: PublicFooterContact;
  socialLinks: PublicFooterSocialLink[];
};

export type AdminFooterSettings = {
  id?: string;
  status: "draft" | "published" | "archived";
  updatedAt?: string;
  source: "fallback" | "database";
  contact: PublicFooterContact;
  socialLinks: PublicFooterSocialLink[];
};
