export default function FoodOrderLoading() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 dark:from-blue-900 dark:via-blue-800 dark:to-cyan-900">
      <div className="mx-auto w-full max-w-md px-4">
        {/* Header skeleton */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-white/20" />
          <div className="h-6 w-32 animate-pulse rounded-lg bg-white/20" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
        </div>
        {/* Card skeleton */}
        <div className="rounded-2xl bg-white/95 dark:bg-card/95 p-6 shadow-xl backdrop-blur-sm">
          <div className="space-y-4">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-blue-100" />
          </div>
        </div>
      </div>
    </section>
  );
}
