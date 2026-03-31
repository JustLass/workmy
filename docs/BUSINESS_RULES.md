# Regras de Negócio

## Usuário

- Email do usuário é único.
- Login exige `username` + `password`.

## Clientes

- Cada cliente pertence a um usuário.
- Telefone é validado no padrão brasileiro.
- Email e telefone de cliente podem se repetir entre registros.

## Serviços

- Cada serviço pertence a um usuário.

## Projetos

- Projeto liga um cliente e um serviço do mesmo usuário.
- Não pode duplicar projeto com mesmo par cliente+serviço para o mesmo usuário.

## Pagamentos

- Pagamento pertence a um projeto.
- `valor` deve ser maior que zero.
- `tipo_pagamento` aceita somente:
  - `MENSAL`
  - `AVULSO`

## Dashboard

- Dashboard mensal agrega pagamentos por mês/ano.
- Pode filtrar por cliente do usuário autenticado.
