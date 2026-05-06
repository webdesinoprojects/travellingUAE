type MarqueeProps = {
  children: React.ReactNode;
  reverse?: boolean;
  repeat?: number;
  className?: string;
};

export function Marquee({
  children,
  reverse = false,
  repeat = 4,
  className = "",
}: MarqueeProps) {
  return (
    <div
      className={[
        "marquee-group flex overflow-hidden [--duration:28s]",
        className,
      ].join(" ")}
    >
      {Array.from({ length: repeat }).map((_, index) => (
        <div
          key={index}
          aria-hidden={index > 0}
          className={[
            "marquee-track flex min-w-full shrink-0 items-center justify-around gap-4 pr-4",
            reverse ? "[animation-direction:reverse]" : "",
          ].join(" ")}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
