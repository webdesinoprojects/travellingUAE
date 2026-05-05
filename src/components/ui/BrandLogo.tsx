import { Plane } from "lucide-react";

type BrandLogoProps = {
  tone?: "light" | "dark";
  size?: "sm" | "md";
};

export function BrandLogo({ tone = "dark", size = "md" }: BrandLogoProps) {
  const isLight = tone === "light";
  const isSmall = size === "sm";

  return (
    <a href="#" className="flex items-center gap-2.5" aria-label="Smart Travel">
      <span
        className={[
          "relative grid place-items-center rounded-lg",
          isSmall ? "size-8" : "size-10",
          isLight ? "bg-white/10 text-white" : "bg-sky-50 text-brand-blue",
        ].join(" ")}
      >
        <span className="absolute inset-[7px] rounded-full border border-dashed border-current opacity-80" />
        <Plane
          aria-hidden="true"
          className={[isSmall ? "size-4" : "size-5", "-rotate-12"].join(" ")}
        />
      </span>
      <span className="leading-none">
        <span
          className={[
            "block font-extrabold tracking-tight",
            isSmall ? "text-[1.2rem]" : "text-[1.45rem]",
            isLight ? "text-white" : "text-[#ee2737]",
          ].join(" ")}
        >
          smart{" "}
          <span className={isLight ? "text-white" : "text-brand-blue"}>
            travel
          </span>
        </span>
        <span
          className={[
            "mt-1 block font-semibold uppercase tracking-[0.28em]",
            isSmall ? "text-[0.48rem]" : "text-[0.58rem]",
            isLight ? "text-white/70" : "text-slate-400",
          ].join(" ")}
        >
          tours and travels
        </span>
      </span>
    </a>
  );
}
