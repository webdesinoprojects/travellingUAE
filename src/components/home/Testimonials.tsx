import Image from "next/image";
import { testimonials } from "@/data/travel";
import { SectionHeading } from "@/components/ui/SectionHeading";

const bentoSpans = [
  "lg:col-span-2",
  "lg:col-span-1",
  "lg:col-span-1",
  "lg:col-span-1",
  "lg:col-span-2",
  "lg:col-span-1",
];

export function Testimonials() {
  return (
    <section className="bg-brand-sky/38 px-4 py-16 text-brand-navy dark:bg-brand-navy dark:text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeading
          eyebrow="Traveler Voices"
          title="Stories From The Route"
          description="A bento wall of recent traveler notes, built to scan quickly without turning the page into a review feed."
        />

        <div className="mt-10 grid auto-rows-[238px] gap-4 md:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((testimonial, index) => (
            <article
              key={testimonial.author}
              className={[
                "group relative overflow-hidden rounded-lg border border-brand-blue/15 bg-surface shadow-[0_16px_40px_rgb(7_23_57/0.08)] transition hover:-translate-y-0.5 dark:border-white/12 dark:bg-white/[0.045]",
                bentoSpans[index] ?? "",
              ].join(" ")}
            >
              {!testimonial.image ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-br from-brand-sand/24 via-transparent to-brand-sky/18 dark:from-brand-sky/14 dark:to-transparent"
                />
              ) : null}
              {testimonial.image ? (
                <Image
                  src={testimonial.image}
                  alt={testimonial.alt ?? testimonial.author}
                  fill
                  sizes="(min-width: 1024px) 620px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : null}
              {testimonial.image ? (
                <div className="absolute inset-0 bg-linear-to-t from-brand-navy/86 via-brand-navy/30 to-transparent" />
              ) : null}
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <p
                  className={[
                    "text-4xl font-black leading-none",
                    testimonial.image
                      ? "text-brand-sand"
                      : "text-brand-brown dark:text-brand-sand",
                  ].join(" ")}
                >
                  &ldquo;
                </p>
                <p
                  className={[
                    "mt-2 max-w-xl text-[1rem] font-semibold leading-8",
                    testimonial.image
                      ? "text-white"
                      : "text-brand-navy dark:text-white",
                  ].join(" ")}
                >
                  {testimonial.quote}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-brand-sky text-xs font-extrabold text-brand-blue">
                    {testimonial.author
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span
                    className={[
                      "text-sm font-extrabold",
                      testimonial.image
                        ? "text-white"
                        : "text-brand-navy dark:text-white",
                    ].join(" ")}
                  >
                    {testimonial.author}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
