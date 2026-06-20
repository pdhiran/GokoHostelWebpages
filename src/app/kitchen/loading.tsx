export default function KitchenLoading() {
  return (
    <section className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 dark:border-border bg-white dark:bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-pulse rounded bg-amber-100" />
            <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
      {/* Order sections skeleton */}
      <div className="p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="mb-3 h-9 animate-pulse rounded-xl bg-gray-200" />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
                      <div className="h-5 w-12 animate-pulse rounded-full bg-gray-100" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                    </div>
                    <div className="mt-3 h-9 w-full animate-pulse rounded-lg bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
