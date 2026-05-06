import {
  BriefcaseBusiness,
  Camera,
  Play,
  Share2,
  type LucideIcon,
} from "lucide-react";

type SocialTone = "facebook" | "youtube" | "instagram" | "linkedin";

type SocialBrandIconProps = {
  tone: SocialTone;
  className?: string;
};

const socialIconMap: Record<SocialTone, LucideIcon> = {
  facebook: Share2,
  youtube: Play,
  instagram: Camera,
  linkedin: BriefcaseBusiness,
};

export function SocialBrandIcon({ tone, className = "" }: SocialBrandIconProps) {
  const Icon = socialIconMap[tone];

  return (
    <Icon
      aria-hidden="true"
      className={["size-4", className].join(" ")}
      strokeWidth={2.4}
    />
  );
}
