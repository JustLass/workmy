# Database

## Entidades principais

### Usuario

- `id` (PK)
- `username` (único)
- `email` (único)
- `telefone` (opcional)

### Cliente

- `id` (PK)
- `usuario_id` (FK -> Usuario)
- `nome`
- `email` (opcional, pode repetir)
- `telefone` (opcional, pode repetir)
- `criado_em`

### Servico

- `id` (PK)
- `usuario_id` (FK -> Usuario)
- `nome`
- `descricao` (opcional)
- `criado_em`

### Projeto

- `id` (PK)
- `usuario_id` (FK -> Usuario)
- `cliente_id` (FK -> Cliente)
- `servico_id` (FK -> Servico)
- `criado_em`

### Pagamento

- `id` (PK)
- `projeto_id` (FK -> Projeto)
- `valor`
- `tipo_pagamento` (`MENSAL` ou `AVULSO`)
- `data`
- `observacao` (opcional)

## Relacionamentos

- Usuario 1:N Cliente
- Usuario 1:N Servico
- Usuario 1:N Projeto
- Projeto 1:N Pagamento
