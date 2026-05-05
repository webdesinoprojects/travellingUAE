import Image from "next/image";
import { testimonials } from "@/data/travel";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Testimonials() {
  return (
    <section className="overflow-hidden bg-surface px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
      <SectionHeading
        title="Hear From Our Travelers"
        description="Experiences shared by our valuable customers who trust Smart Travel for unforgettable journeys."
      />

      <div className="no-scrollbar mx-auto mt-10 flex max-w-[1700px] gap-6 overflow-x-auto pb-4 lg:grid lg:grid-cols-6 lg:items-center lg:gap-7 lg:overflow-visible">
        {testimonials.map((testimonial, index) =>
          testimonial.image ? (
            <figure
              key={testimonial.author}
              className="relative h-[250px] min-w-[260px] overflow-hidden rounded-lg lg:min-w-0"
            >
              <Image
                src={testimonial.image}
                alt={testimonial.alt ?? testimonial.author}
                fill
                sizes="(min-width: 1024px) 260px, 260px"
                className="object-cover"
              />
            </figure>
          ) : (
            <TestimonialCard
              key={testimonial.author}
              quote={testimonial.quote}
              author={testimonial.author}
              className={index % 2 === 0 ? "lg:translate-y-10" : ""}
            />
          ),
        )}
      </div>
    </section>
  );
}

function TestimonialCard({
  quote,
  author,
  className,
}: {
  quote: string;
  author: string;
  className?: string;
}) {
  return (
    <article
      className={[
        "soft-card-shadow min-w-[260px] rounded-lg border border-border-soft bg-white p-5 dark:bg-neutral-950 lg:min-w-0",
        className ?? "",
      ].join(" ")}
    >
      <p className="-mt-3 text-7xl font-black leading-none text-brand-blue">
        &ldquo;
      </p>
      <p className="-mt-5 text-base font-medium leading-7 text-slate-900 dark:text-slate-100">
        {quote}{" "}
        <a href="#contact" className="font-semibold text-brand-blue">
          Read More
        </a>
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-500 dark:bg-neutral-800 dark:text-neutral-200">
          {author
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {author}
        </p>
      </div>
    </article>
  );
}
