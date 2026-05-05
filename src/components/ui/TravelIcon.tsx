import {
  BadgeCheck,
  BriefcaseBusiness,
  BusFront,
  Hotel,
  MapPinned,
  Plane,
  ShieldCheck,
  Ship,
  TicketsPlane,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { TravelIconKey } from "@/types/travel";

const iconMap: Record<TravelIconKey, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  package: MapPinned,
  wellness: BriefcaseBusiness,
  cruise: Ship,
  visa: BadgeCheck,
  bus: BusFront,
  passport: WalletCards,
  document: TicketsPlane,
  insurance: ShieldCheck,
};

type TravelIconProps = {
  icon: TravelIconKey;
  className?: string;
  strokeWidth?: number;
};

export function TravelIcon({
  icon,
  className,
  strokeWidth = 2,
}: TravelIconProps) {
  const Icon = iconMap[icon];

  return (
    <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />
  );
}
