import { Phone } from "lucide-react";

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/919048317711"
      aria-label="Chat on WhatsApp"
      className="fixed right-4 top-28 z-50 grid size-14 place-items-center rounded-lg bg-[#03d76b] text-white shadow-lg shadow-emerald-600/25 transition hover:-translate-y-0.5 sm:right-6"
    >
      <span
        aria-hidden="true"
        className="relative grid size-9 place-items-center rounded-full border-[3px] border-white"
      >
        <span className="absolute -bottom-0.5 left-1 h-3 w-3 rotate-[-28deg] rounded-bl-[9px] border-b-[3px] border-l-[3px] border-white bg-[#03d76b]" />
        <Phone className="size-4 rotate-[-18deg] fill-white" strokeWidth={3} />
      </span>
    </a>
  );
}
