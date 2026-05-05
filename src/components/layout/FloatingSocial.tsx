const socialItems = [
  { label: "Facebook", value: "f" },
  { label: "YouTube", value: "play" },
  { label: "Instagram", value: "ig" },
  { label: "LinkedIn", value: "in" },
];

export function FloatingSocial() {
  return (
    <aside
      aria-label="Social links"
      className="fixed bottom-24 right-6 z-30 hidden rounded-[1.6rem] border border-white/70 bg-slate-400/85 px-3 py-5 text-white shadow-lg backdrop-blur-md lg:block"
    >
      <div className="grid gap-5 text-center text-sm font-extrabold">
        {socialItems.map((item) => (
          <a
            key={item.label}
            href="#"
            aria-label={item.label}
            className="grid size-6 place-items-center rounded-md transition hover:bg-white/20"
          >
            {item.value === "play" ? (
              <span className="text-[0.68rem]">YT</span>
            ) : (
              item.value
            )}
          </a>
        ))}
      </div>
    </aside>
  );
}
