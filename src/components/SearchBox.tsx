/** Plain GET search form (works without JavaScript). */
export function SearchBox({ q, placeholder, children }: { q?: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <input name="q" defaultValue={q} placeholder={placeholder} className="input max-w-sm" aria-label="Search" />
      <button className="btn-ghost">Search</button>
      {children}
    </form>
  );
}
