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
        <p className="mb-3 text-sm font-extrabold uppercase text-brand-brown">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-4xl font-semibold leading-[1.05] text-brand-navy dark:text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-brand-blue/78 dark:text-brand-sky sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
