export const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value || 0),
  )

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(value))
