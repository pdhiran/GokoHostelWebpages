export default function AdminLoading() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-brand-sand dark:bg-background">
      <div className="w-full max-w-[1400px] px-4 sm:px-6">
        {/* Nav skeleton */}
        <div className="mb-6 flex items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-brand-green/[0.06]" />
          ))}
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-brand-mist bg-white dark:bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-brand-green/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-12 animate-pulse rounded bg-brand-green/[0.08]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-brand-green/[0.05]" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="mt-6 rounded-2xl border border-brand-mist bg-white dark:bg-card p-4">
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-brand-green/[0.08]" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-24 animate-pulse rounded bg-brand-green/[0.06]" />
                <div className="h-4 flex-1 animate-pulse rounded bg-brand-green/[0.04]" />
                <div className="h-4 w-16 animate-pulse rounded bg-brand-green/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
