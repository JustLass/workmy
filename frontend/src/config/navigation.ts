import type { ComponentType } from 'react'
import {
  IconBriefcase,
  IconHome,
  IconLink,
  IconUsers,
  IconWallet,
} from '../shared/ui/NavIcons'

export type NavItem = {
  to: string
  label: string
  shortLabel?: string
  Icon: ComponentType<{ className?: string }>
}

export const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Início', shortLabel: 'Início', Icon: IconHome },
  { to: '/clientes', label: 'Clientes', shortLabel: 'Clientes', Icon: IconUsers },
  { to: '/servicos', label: 'Serviços', shortLabel: 'Serviços', Icon: IconBriefcase },
  { to: '/contratos', label: 'Contratos', shortLabel: 'Contratos', Icon: IconLink },
  { to: '/pagamentos', label: 'Financeiro', shortLabel: 'Financeiro', Icon: IconWallet },
]
