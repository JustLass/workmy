import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center px-5 py-10 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50">
      <h4 className="m-0 mb-2 text-base font-semibold text-on-surface">{title}</h4>
      {description && <p className="m-0 mb-5 text-sm text-on-surface-variant">{description}</p>}
      {action}
    </div>
  )
}
