export type LocaleDirection = "ltr" | "rtl";

export type PublicLocale = {
  code: string;
  name: string;
  direction: LocaleDirection;
  isDefault: boolean;
};

export type PublicTranslationBundle = {
  locale: PublicLocale;
  namespaces: string[];
  messages: Record<string, Record<string, string>>;
};

export type PublicHeaderCopy = {
  enquire: string;
};

export type AdminTranslationStatus = "draft" | "published" | "archived";

export type AdminTranslationEntry = {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  status: AdminTranslationStatus;
  updatedAt: string | null;
};

export type AdminTranslationContent = {
  source: "database" | "unconfigured";
  locales: PublicLocale[];
  entries: AdminTranslationEntry[];
};
