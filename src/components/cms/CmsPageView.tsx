import { CalendarDays } from "lucide-react";
import type { PublicCmsPage } from "@/types/cms";

type CmsPageViewProps = {
  page: PublicCmsPage;
};

export function CmsPageView({ page }: CmsPageViewProps) {
  const blocks = toBodyBlocks(page.body);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-32 text-foreground sm:px-6 lg:px-10">
      <article className="mx-auto w-full max-w-[1040px]">
        <header className="rounded-lg border border-border-soft bg-surface/86 p-6 shadow-[0_18px_50px_rgb(7_23_57/0.08)] backdrop-blur sm:p-8 lg:p-10">
          <p className="text-sm font-extrabold uppercase text-brand-brown">
            Fly Time Desk
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold leading-tight text-brand-navy sm:text-5xl dark:text-white">
            {page.title}
          </h1>
          {page.excerpt ? (
            <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-brand-blue dark:text-brand-sky">
              {page.excerpt}
            </p>
          ) : null}
          {page.updatedAt ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border-soft bg-surface-muted px-3 py-2 text-xs font-bold uppercase text-brand-blue dark:bg-white/[0.06] dark:text-brand-sky">
              <CalendarDays aria-hidden="true" className="size-4" />
              Updated {formatDate(page.updatedAt)}
            </p>
          ) : null}
        </header>

        <section className="mt-6 rounded-lg border border-border-soft bg-surface/92 p-6 shadow-[0_18px_50px_rgb(7_23_57/0.08)] sm:p-8 lg:p-10">
          <div className="grid gap-6 text-base font-medium leading-8 text-brand-navy/82 dark:text-white/78">
            {blocks.map((block, index) => (
              <p key={`${page.slug}-${index}`}>{block}</p>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}

function toBodyBlocks(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
