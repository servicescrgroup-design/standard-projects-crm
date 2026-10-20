/** Shown instantly while a page's data loads, so navigation never looks frozen. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-white" />
      <div className="h-4 w-72 rounded bg-white" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="card h-16" />
        ))}
      </div>
    </div>
  );
}
