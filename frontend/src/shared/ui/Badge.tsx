import { cn } from '../lib/cn'

type BadgeVariant = 'mensal' | 'quinzenal' | 'avulso' | 'neutral'

type BadgeProps = {
  variant?: BadgeVariant
  children: React.ReactNode
}

const variantClass: Record<BadgeVariant, string> = {
  mensal: 'badge-mensal',
  quinzenal: 'badge-quinzenal',
  avulso: 'badge-avulso',
  neutral: 'badge-neutral',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={cn('badge', variantClass[variant])}>{children}</span>
}
