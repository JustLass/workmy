# 📝 Diagramas de Sequência — Operações CRUD

> Este documento apresenta os **Diagramas de Sequência UML** das operações CRUD (Create, Read, Update, Delete) do sistema WorkMy, utilizando como exemplos representativos as entidades **Cliente** e **Projeto**.

---

## 1. Visão Geral

Todas as operações CRUD seguem o mesmo padrão arquitetural multicamada:

```
SPA → BFF (injeta Bearer) → FastAPI Router → Use Case → Repository → PostgreSQL
```

O **BFF injeta o JWT** (cookies HTTP-Only) no header `Authorization: Bearer`. O **Router** valida o token e extrai o `usuario_id`. O **Use Case** aplica regras de negócio. O **Repository** persiste no banco.

---

## 2. CRUD de Cliente — Criar (POST)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA<br/>(ClientesPage.tsx)
    participant BFF as BFF Express
    participant R as Router<br/>(rest/clientes.py)
    participant UC as CrudClienteUseCase<br/>(Application)
    participant REPO as ClienteRepository<br/>(Infrastructure)
    participant DB as PostgreSQL

    U->>SPA: Preenche formulário de novo cliente<br/>(nome, empresa, email, telefone)
    SPA->>BFF: POST /api/clientes<br/>{nome, empresa, email, telefone}<br/>credentials: include

    BFF->>BFF: Middleware: injeta Bearer JWT<br/>do cookie workmy_access
    BFF->>R: POST /api/clientes<br/>Authorization: Bearer jwt

    R->>R: get_current_user_id(token)<br/>Extrai usuario_id do JWT
    R->>UC: criar(usuario_id, nome, empresa, email, telefone)

    UC->>REPO: exists_by_name(nome, usuario_id)
    REPO->>DB: SELECT 1 FROM clientes<br/>WHERE nome = ? AND usuario_id = ?<br/>AND deletado_em IS NULL
    DB-->>REPO: true / false

    alt Nome já existe
        UC-->>R: ValidaEntidadeException<br/>"Já existe um cliente com este nome."
        R-->>BFF: 400 {detail}
        BFF-->>SPA: 400 (erro)
        SPA-->>U: Toast de erro
    else Nome disponível
        UC->>UC: ClienteEntity(nome, empresa, ...)<br/>entity.validate()
        UC->>REPO: save(cliente)
        REPO->>DB: INSERT INTO clientes<br/>(usuario_id, nome, empresa, email, telefone, criado_em)
        DB-->>REPO: ClienteModel (com id gerado)
        REPO-->>UC: ClienteEntity
        UC-->>R: ClienteEntity
        R-->>BFF: 201 {id, nome, empresa, ...}
        BFF-->>SPA: 201 (sucesso)
        SPA->>SPA: Invalida cache + re-fetch
        SPA-->>U: Lista atualizada + Toast de sucesso
    end
```

---

## 3. CRUD de Cliente — Listar (GET)

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant BFF as BFF Express
    participant R as Router clientes.py
    participant REPO as ClienteRepository
    participant DB as PostgreSQL

    SPA->>BFF: GET /api/clientes<br/>credentials: include
    BFF->>BFF: Injeta Bearer JWT
    BFF->>R: GET /api/clientes<br/>Authorization: Bearer jwt

    R->>R: get_current_user_id(token)
    R->>REPO: list_all(usuario_id)
    REPO->>DB: SELECT * FROM clientes<br/>WHERE usuario_id = ?<br/>AND deletado_em IS NULL<br/>ORDER BY criado_em DESC
    DB-->>REPO: [ClienteModel, ...]
    REPO-->>R: [ClienteEntity, ...]
    R-->>BFF: 200 [{id, nome, empresa, ...}, ...]
    BFF-->>SPA: 200 (dados)
    SPA->>SPA: writeCache("clientes", dados)
    SPA->>SPA: Renderiza a lista na UI
```

---

## 4. CRUD de Cliente — Atualizar (PUT)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant BFF as BFF Express
    participant R as Router clientes.py
    participant UC as CrudClienteUseCase
    participant REPO as ClienteRepository
    participant DB as PostgreSQL

    U->>SPA: Edita campos do cliente
    SPA->>BFF: PUT /api/clientes/{id}<br/>{nome, empresa, email, telefone}

    BFF->>R: PUT /api/clientes/{id}<br/>Authorization: Bearer jwt

    R->>R: get_current_user_id(token)
    R->>UC: atualizar(cliente_id, usuario_id, nome, empresa, email, telefone)

    UC->>REPO: get_by_id(cliente_id, usuario_id)
    REPO->>DB: SELECT * FROM clientes<br/>WHERE id = ? AND usuario_id = ?<br/>AND deletado_em IS NULL
    DB-->>REPO: ClienteModel (ou null)

    alt Cliente não encontrado
        UC-->>R: NaoEncontradoException
        R-->>BFF: 404
        BFF-->>SPA: 404
        SPA-->>U: Toast "Cliente não encontrado"
    else Cliente encontrado
        UC->>REPO: exists_by_name(nome, usuario_id, exclude_id=cliente_id)
        REPO->>DB: SELECT 1 WHERE nome = ? AND id != ?

        alt Nome duplicado
            UC-->>R: ValidaEntidadeException
            R-->>BFF: 400
        else OK
            UC->>UC: Atualiza campos da entity<br/>entity.validate()
            UC->>REPO: save(cliente)
            REPO->>DB: UPDATE clientes SET ... WHERE id = ?
            DB-->>REPO: OK
            UC-->>R: ClienteEntity atualizado
            R-->>BFF: 200
            BFF-->>SPA: 200
            SPA-->>U: Toast de sucesso + lista atualizada
        end
    end
```

---

## 5. CRUD de Cliente — Deletar (DELETE) — Soft Delete

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant BFF as BFF Express
    participant R as Router clientes.py
    participant UC as CrudClienteUseCase
    participant REPO as ClienteRepository
    participant DB as PostgreSQL

    U->>SPA: Confirma exclusão do cliente
    SPA->>BFF: DELETE /api/clientes/{id}

    BFF->>R: DELETE /api/clientes/{id}<br/>Authorization: Bearer jwt

    R->>R: get_current_user_id(token)
    R->>UC: deletar(cliente_id, usuario_id)

    UC->>REPO: get_by_id(cliente_id, usuario_id)

    alt Cliente não encontrado
        UC-->>R: NaoEncontradoException (404)
    else Cliente existe
        UC->>REPO: count_projetos_ativos(cliente_id, usuario_id)
        REPO->>DB: SELECT COUNT(*) FROM projetos<br/>WHERE cliente_id = ? AND deletado_em IS NULL
        DB-->>REPO: count

        alt Tem projetos ativos
            UC-->>R: ConflitoDeletarException<br/>"Não é possível deletar cliente<br/>com N projeto(s) associado(s)."
            R-->>BFF: 409 Conflict
            BFF-->>SPA: 409
            SPA-->>U: Toast de erro com detalhe
        else Sem dependências
            UC->>UC: cliente.deletado_em = now() (Soft Delete)
            UC->>REPO: save(cliente)
            REPO->>DB: UPDATE clientes<br/>SET deletado_em = NOW()<br/>WHERE id = ?
            DB-->>REPO: OK
            UC-->>R: 204 No Content
            R-->>BFF: 204
            BFF-->>SPA: 204
            SPA-->>U: Lista atualizada
        end
    end
```

---

## 6. Criar Projeto — Com Regras de Negócio + Evento Assíncrono

Este fluxo é mais complexo pois envolve **validação de múltiplas entidades** e **publicação de evento** no RabbitMQ para invalidação de cache via SSE:

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA<br/>(ProjetosPage.tsx)
    participant BFF as BFF Express
    participant R as Router<br/>(rest/projetos.py)
    participant UC as CriarProjetoUseCase
    participant CR as ClienteRepository
    participant SR as ServicoRepository
    participant PR as ProjetoRepository
    participant EV as RabbitMQ Publisher
    participant DB as PostgreSQL

    U->>SPA: Preenche formulário de novo projeto<br/>(cliente, serviço, status, valor, recorrência)
    SPA->>BFF: POST /api/projetos<br/>{cliente_id, servico_id, status, ...}
    BFF->>R: POST /api/projetos (Bearer JWT)
    R->>R: get_current_user_id(token)
    R->>UC: execute(usuario_id, cliente_id, servico_id, ...)

    Note over UC,DB: Validação 1 — Cliente pertence ao usuário?
    UC->>CR: exists_by_id(cliente_id, usuario_id)
    CR->>DB: SELECT 1 FROM clientes WHERE id = ? AND usuario_id = ?
    DB-->>CR: true/false

    alt Cliente não pertence ao usuário
        UC-->>R: ValidaEntidadeException
        R-->>BFF: 400 "Cliente não encontrado ou não pertence a você."
    end

    Note over UC,DB: Validação 2 — Serviço pertence ao usuário?
    UC->>SR: exists_by_id(servico_id, usuario_id)
    SR->>DB: SELECT 1 FROM servicos WHERE id = ? AND usuario_id = ?
    DB-->>SR: true/false

    alt Serviço não pertence ao usuário
        UC-->>R: ValidaEntidadeException
        R-->>BFF: 400 "Serviço não encontrado ou não pertence a você."
    end

    Note over UC,DB: Validação 3 — Colisão de contrato ativo?
    UC->>PR: exists_active_contract(cliente_id, servico_id)
    PR->>DB: SELECT 1 FROM projetos<br/>WHERE cliente_id = ? AND servico_id = ?<br/>AND deletado_em IS NULL
    DB-->>PR: true/false

    alt Contrato ativo já existe
        UC-->>R: ColisaoContratoException
        R-->>BFF: 400 "Este cliente já possui este serviço contratado."
    else Sem colisão
        UC->>UC: ProjetoEntity(...)<br/>sync_recorrencia()<br/>validate()
        UC->>PR: save(projeto)
        PR->>DB: INSERT INTO projetos (...)
        DB-->>PR: ProjetoModel (com id)
        PR-->>UC: ProjetoEntity

        Note over UC,EV: Evento assíncrono → SSE
        UC->>EV: publish(usuario_id, "projetos", "created",<br/>{projeto_id})
        EV-->>SPA: SSE event → invalida cache de projetos

        UC-->>R: ProjetoEntity
        R-->>BFF: 201 ProjetoOut
        BFF-->>SPA: 201
        SPA-->>U: Projeto criado + lista atualizada
    end
```

---

## 7. Rastreabilidade — Código-Fonte

| Diagrama | Arquivo Principal |
|---|---|
| CRUD Cliente (Criar/Atualizar/Deletar) | `backend-fastapi/src/application/usecases/crud_cliente.py` |
| CRUD Cliente (Router) | `backend-fastapi/src/presentation/rest/clientes.py` |
| Criar Projeto (Use Case) | `backend-fastapi/src/application/usecases/criar_projeto.py` |
| Criar Projeto (Router) | `backend-fastapi/src/presentation/rest/projetos.py` |
| RabbitMQ Publisher | `backend-fastapi/src/infrastructure/messaging/rabbitmq_publisher.py` |
| Frontend ClientesPage | `frontend/src/pages/ClientesPage.tsx` |
| Frontend ProjetosPage | `frontend/src/pages/ProjetosPage.tsx` |
| BFF (injeção JWT) | `frontend/bff/server.js` — middleware (linhas 216-271) |

---

## 8. Padrões Observados nos CRUDs

| Padrão | Descrição |
|---|---|
| **Soft Delete** | Todas as exclusões setam `deletado_em = NOW()` — o registro não é removido fisicamente. |
| **Isolamento por usuario_id** | Toda query filtra `WHERE usuario_id = ?` — um usuário nunca vê dados de outro. |
| **Validação no Domain** | `entity.validate()` é chamado antes de salvar, garantindo regras de negócio no núcleo. |
| **Evento assíncrono (RabbitMQ)** | Mutações disparam eventos para invalidação de cache em tempo real via SSE. |
| **Injeção de Dependência** | `dependencies.py` monta a composição Use Case + Repositories via `Depends()` do FastAPI. |
