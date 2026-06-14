export default function FoodOrderLoading() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-brand-sand">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-green-dark border-t-transparent" />
        <p className="text-sm text-brand-green-dark/50">Loading menu...</p>
      </div>
    </section>
  );
}
