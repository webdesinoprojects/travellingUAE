type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  title,
  eyebrow,
  description,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div
      className={[
        "mx-auto max-w-5xl",
        align === "center" ? "text-center" : "text-left",
      ].join(" ")}
    >
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-brand-blue">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-4xl leading-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-4xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
