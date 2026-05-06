import {
  ChartNoAxesCombined,
  CreditCard,
  SquareMenu,
  Users,
  type LucideIcon,
} from "lucide-react";

const steps: Array<{
  label: string;
  icon: LucideIcon;
  active?: boolean;
}> = [
  { label: "Search Results", icon: ChartNoAxesCombined, active: true },
  { label: "Add On", icon: SquareMenu },
  { label: "Traveler Details", icon: Users },
  { label: "Payment", icon: CreditCard },
];

type BookingStepperProps = {
  className?: string;
};

export function BookingStepper({ className = "" }: BookingStepperProps) {
  return (
    <div className={["mx-auto w-full max-w-[980px] px-4", className].join(" ")}>
      <ol className="grid grid-cols-4 items-start">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <li
              key={step.label}
              className="relative flex min-w-0 flex-col items-center text-center"
            >
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-[13px] h-px bg-border-soft"
                />
              ) : null}
              <span
                className={[
                  "relative z-10 grid size-7 place-items-center rounded-full text-white shadow-sm",
                  step.active
                    ? "bg-brand-blue dark:bg-brand-sand dark:text-brand-navy"
                    : "bg-brand-brown/60 dark:bg-white/24",
                ].join(" ")}
              >
                <Icon aria-hidden="true" className="size-4" strokeWidth={2.4} />
              </span>
              <span
                className={[
                  "mt-3 text-[15px] leading-none",
                  step.active
                    ? "text-brand-blue dark:text-brand-sand"
                    : "text-brand-brown dark:text-white/55",
                ].join(" ")}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
