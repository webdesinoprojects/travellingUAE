import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  tone?: "light" | "dark";
  size?: "sm" | "md";
};

export function BrandLogo({ tone = "dark", size = "md" }: BrandLogoProps) {
  const isLight = tone === "light";
  const dimensions =
    size === "sm"
      ? { width: 164, height: 40, className: "h-10 w-[164px]" }
      : { width: 210, height: 51, className: "h-[51px] w-[210px]" };

  return (
    <Link
      href="/"
      className={[
        "inline-flex items-center rounded-lg p-1.5 transition",
        isLight ? "bg-brand-navy/85" : "bg-brand-navy shadow-sm",
      ].join(" ")}
      aria-label="Fly Time home"
    >
      <Image
        src="/assets/brand/flytime-logo.png"
        alt="Fly Time"
        width={dimensions.width}
        height={dimensions.height}
        unoptimized
        className={dimensions.className}
      />
    </Link>
  );
}
