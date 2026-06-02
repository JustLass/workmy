type StatCardProps = {
  label: string
  value: string | number
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="relative overflow-hidden bg-surface border border-outline-variant/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <p className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <h3 className="m-0 text-2xl font-bold tracking-tight text-on-surface font-display-lg">
        {value}
      </h3>
    </article>
  )
}
