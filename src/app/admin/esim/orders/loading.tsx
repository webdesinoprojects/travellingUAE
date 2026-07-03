/** Lightweight skeleton shown while the eSIM orders page streams in. */
export default function AdminEsimOrdersLoading() {
  return (
    <div className="grid animate-pulse gap-5" aria-hidden="true">
      <div className="h-8 w-40 rounded-lg bg-[#e9dcc6] dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 rounded-lg bg-[#e9dcc6] dark:bg-white/10" />
        ))}
      </div>
      <div className="h-11 rounded-lg bg-[#e9dcc6] dark:bg-white/10" />
      <div className="h-72 rounded-lg bg-[#e9dcc6] dark:bg-white/10" />
    </div>
  );
}
