import {
  BadgeCheck,
  BriefcaseBusiness,
  BusFront,
  CarFront,
  Hotel,
  Landmark,
  MapPinned,
  Plane,
  ShieldCheck,
  Ship,
  Smartphone,
  TicketsPlane,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { TravelIconKey } from "@/types/travel";

const iconMap: Record<TravelIconKey, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  package: MapPinned,
  hajj: Landmark,
  wellness: BriefcaseBusiness,
  cruise: Ship,
  visa: BadgeCheck,
  bus: BusFront,
  transfer: BusFront,
  car: CarFront,
  passport: WalletCards,
  document: TicketsPlane,
  insurance: ShieldCheck,
  sim: Smartphone,
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
