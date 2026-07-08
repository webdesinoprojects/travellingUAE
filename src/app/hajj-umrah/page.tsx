import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HajjUmrahEnquiryForm } from "@/components/hajj-umrah/HajjUmrahEnquiryForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicHajjUmrahContent } from "@/server/public/hajj-umrah";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicHajjUmrahContent();

  return {
    title: content.seoTitle,
    description: content.seoDescription,
  };
}

export default async function HajjUmrahPage() {
  const content = await getPublicHajjUmrahContent();

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative min-h-[420px] overflow-hidden sm:min-h-[500px] lg:min-h-[560px]">
          <div
            className={`absolute inset-0 grid ${
              content.heroImages.length > 1
                ? "grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            }`}
          >
            {content.heroImages.map((image, index) => (
              <div key={`${image.url}-${index}`} className="relative min-w-0">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  priority={index === 0}
                  sizes={
                    content.heroImages.length > 1
                      ? "(min-width: 1024px) 34vw, 50vw"
                      : "100vw"
                  }
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/25 via-brand-navy/10 to-brand-navy/68" />
          <div className="absolute inset-x-0 bottom-0 bg-black/28 py-8 backdrop-blur-[1px]">
            <div className="mx-auto w-full max-w-[1660px] px-4 text-center sm:px-6 lg:px-10">
              <h1 className="font-serif text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
                {content.heroTitle}
              </h1>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-[1660px] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-10 lg:py-12 xl:gap-16">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="mb-9 flex items-center gap-2 text-sm font-semibold text-foreground-muted"
            >
              <Link href="/" className="transition hover:text-brand-blue">
                Home
              </Link>
              <ChevronRight aria-hidden="true" className="size-4" />
              <span className="text-brand-blue">{content.breadcrumbLabel}</span>
            </nav>

            <article className="max-w-5xl break-words">
              <h2 className="font-serif text-3xl font-semibold leading-tight text-brand-blue sm:text-4xl">
                {content.pageHeading}
              </h2>

              <div className="mt-6 grid gap-5 text-base font-medium leading-8 text-brand-navy/86 dark:text-white/78">
                <MarkdownContent markdown={content.contentMarkdown} />
              </div>

              <div className="mt-7">
                <h3 className="text-lg font-extrabold text-brand-navy dark:text-white">
                  Key Benefits:
                </h3>
                <ul className="mt-4 grid gap-3 text-base font-semibold text-brand-navy/86 dark:text-white/78">
                  {content.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-brand-blue dark:text-brand-sky"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-base font-semibold leading-8 text-brand-navy/86 dark:text-white/78">
                  {content.closingCtaText}
                </p>
              </div>
            </article>
          </div>

          <aside className="min-w-0 lg:pt-14">
            <div className="lg:sticky lg:top-28">
              <HajjUmrahEnquiryForm
                intro={content.formIntro}
                title={content.formTitle}
              />
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const blocks = toBlocks(markdown);

  return blocks.map((block, index) => {
    const key = `${block.type}-${index}-${block.content.slice(0, 16)}`;

    if (block.type === "heading") {
      return (
        <h3
          key={key}
          className="font-serif text-2xl font-semibold leading-tight text-brand-navy dark:text-white"
        >
          {block.content}
        </h3>
      );
    }

    if (block.type === "quote") {
      return (
        <blockquote
          key={key}
          className="border-l-4 border-brand-sand pl-4 font-semibold italic text-brand-blue dark:text-brand-sky"
        >
          {renderInline(block.content)}
        </blockquote>
      );
    }

    if (block.type === "code") {
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg border border-border-soft bg-brand-navy p-4 text-sm leading-6 text-white"
        >
          <code>{block.content}</code>
        </pre>
      );
    }

    if (block.type === "image") {
      return (
        <figure key={key} className="overflow-hidden rounded-lg border border-border-soft">
          <Image
            src={block.url}
            alt={block.alt}
            width={1200}
            height={720}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="h-auto w-full object-cover"
          />
          {block.alt ? (
            <figcaption className="bg-surface-muted px-3 py-2 text-xs font-bold text-brand-brown">
              {block.alt}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    return <p key={key}>{renderInline(block.content)}</p>;
  });
}

type MarkdownBlock =
  | { type: "heading" | "quote" | "paragraph" | "code"; content: string }
  | { type: "image"; content: string; url: string; alt: string };

function toBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", content: paragraph.join(" ") });
      paragraph = [];
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", content: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);

    if (image && isTrustedMediaUrl(image[2])) {
      flushParagraph();
      blocks.push({
        type: "image",
        content: trimmed,
        alt: image[1] ?? "",
        url: image[2],
      });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "heading", content: trimmed.slice(2).trim() });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "heading", content: trimmed.slice(3).trim() });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      blocks.push({ type: "quote", content: trimmed.slice(2).trim() });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();

  if (code) {
    blocks.push({ type: "code", content: code.join("\n") });
  }

  return blocks;
}

function isTrustedMediaUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      ["images.unsplash.com", "res.cloudinary.com", "ik.imagekit.io"].includes(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}

function renderInline(value: string) {
  const parts = value.split(/(\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)$/);

    if (link) {
      return (
        <a
          key={`${part}-${index}`}
          href={link[2]}
          className="font-extrabold text-brand-blue underline decoration-brand-sand underline-offset-4 dark:text-brand-sky"
          rel={link[2].startsWith("http") ? "noreferrer" : undefined}
          target={link[2].startsWith("http") ? "_blank" : undefined}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}
