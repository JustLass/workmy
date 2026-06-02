import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl sm:text-[26px] font-bold tracking-tight text-on-surface font-display-lg">
            {title}
          </h2>
          {description && <p className="m-0 mt-1 text-sm text-on-surface-variant">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5 items-center">{actions}</div>}
      </div>
    </header>
  )
}
