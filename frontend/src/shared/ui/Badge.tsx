import { cn } from '../lib/cn'

type BadgeVariant = 'mensal' | 'quinzenal' | 'avulso' | 'neutral'

type BadgeProps = {
  variant?: BadgeVariant
  children: React.ReactNode
}

const base =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border'

const variantClass: Record<BadgeVariant, string> = {
  mensal: 'bg-primary-container text-on-primary-container border-primary/20',
  quinzenal: 'bg-amber-100 text-amber-800 border-amber-300/50',
  avulso: 'bg-surface-container text-on-surface-variant border-outline-variant',
  neutral: 'bg-surface-container text-on-surface-variant border-outline-variant',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={cn(base, variantClass[variant])}>{children}</span>
}
