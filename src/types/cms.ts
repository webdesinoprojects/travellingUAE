export type PublicCmsPage = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
};

export type AdminCmsPageStatus = "draft" | "published" | "archived";

export type AdminCmsPage = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  status: AdminCmsPageStatus;
  updatedAt: string | null;
};

export type AdminCmsPageContent = {
  source: "database" | "unconfigured";
  pages: AdminCmsPage[];
};
