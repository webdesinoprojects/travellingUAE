import { SocialBrandIcon } from "@/components/ui/SocialBrandIcon";

const socialItems = [
  { label: "Facebook", href: "#", tone: "facebook" as const },
  { label: "YouTube", href: "#", tone: "youtube" as const },
  { label: "Instagram", href: "#", tone: "instagram" as const },
  { label: "LinkedIn", href: "#", tone: "linkedin" as const },
];

export function FloatingSocial() {
  return (
    <aside
      aria-label="Social links"
      className="fixed bottom-24 right-6 z-30 hidden rounded-lg border border-border-soft bg-surface/92 px-2 py-3 shadow-[0_16px_34px_rgb(7_23_57/0.22)] backdrop-blur-md lg:block dark:bg-black/88"
    >
      <div className="grid gap-2">
        {socialItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-label={item.label}
            className="grid size-9 place-items-center rounded-lg text-brand-blue transition hover:scale-105 hover:bg-surface-muted dark:text-brand-sand dark:hover:bg-white/[0.08]"
          >
            <SocialBrandIcon tone={item.tone} />
          </a>
        ))}
      </div>
    </aside>
  );
}
