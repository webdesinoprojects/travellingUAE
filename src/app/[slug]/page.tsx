import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/components/cms/CmsPageView";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicCmsPage } from "@/server/public/cms";

type CmsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CmsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicCmsPage(slug);

  if (!page) {
    return {
      title: "Page Not Found | Fly Time",
    };
  }

  return {
    title: `${page.seoTitle ?? page.title} | Fly Time`,
    description:
      page.seoDescription ??
      page.excerpt ??
      "Fly Time travel desk information.",
  };
}

export default async function CmsPage({ params }: CmsPageProps) {
  const { slug } = await params;
  const page = await getPublicCmsPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <CmsPageView page={page} />
      <SiteFooter />
    </>
  );
}
