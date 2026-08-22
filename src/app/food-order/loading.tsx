export default function FoodOrderLoading() {
  return (
    <section className="flex min-h-screen items-center justify-center goko-mesh goko-noise bg-brand-sand dark:bg-background">
      <div className="mx-auto w-full max-w-md px-4">
        {/* Header skeleton */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-brand-green/10" />
          <div className="h-6 w-32 animate-pulse rounded-lg bg-brand-green/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-brand-green/10" />
        </div>
        {/* Card skeleton */}
        <div className="rounded-2xl bg-white/95 dark:bg-card/95 p-6 shadow-xl dark:shadow-none backdrop-blur-sm">
          <div className="space-y-4">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-4 w-36 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-brand-green/10 dark:bg-brand-green/20" />
          </div>
        </div>
      </div>
    </section>
  );
}
