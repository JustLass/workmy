# 🎯 WorkMy — Resumo para Apresentação (Pitch)

> Versão simplificada dos diagramas do projeto, pensada para slides.
> **3 diagramas essenciais**: Arquitetura → Login → Banco de Dados (DER).
> Cada um cabe em 1 slide e tem o roteiro de fala logo abaixo.

---

## O que é o WorkMy? (Slide de abertura)

Sistema de gestão para **freelancers**: cadastro de clientes, serviços, projetos e controle de pagamentos (avulsos e mensais), com cobrança recorrente automática.

---

## 1️⃣ Arquitetura — Integração Front → Back → Banco

```mermaid
flowchart LR
    U([👤 Usuário]) --> SPA

    subgraph Frontend
        SPA["React SPA<br/>(interface)"]
        BFF["BFF Express<br/>(gateway seguro)"]
    end

    subgraph Backend
        API["FastAPI<br/>(regras de negócio)"]
    end

    subgraph Dados
        DB[("PostgreSQL<br/>(banco de dados)")]
    end

    SPA -- "HTTP + cookies seguros" --> BFF
    BFF -- "HTTP + token JWT" --> API
    API -- "SQL (ORM)" --> DB
```

### Como explicar (30 segundos)

O sistema tem **4 camadas, cada uma com uma única responsabilidade**:

1. **React SPA** — a tela que o usuário vê.
2. **BFF (Backend For Frontend)** — um "porteiro" entre o front e o back. Ele guarda o token de autenticação em cookies seguros, para o navegador nunca ter acesso direto ao token.
3. **FastAPI** — onde moram as regras de negócio (validações, cálculos, permissões).
4. **PostgreSQL** — onde os dados ficam guardados.

**Frase de impacto:** *"O front nunca fala direto com o banco e nunca vê o token — cada camada só conhece a vizinha. Isso dá segurança e facilidade de manutenção."*

---

## 2️⃣ Diagrama de Sequência — Login

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant BFF as BFF Express
    participant API as FastAPI
    participant DB as PostgreSQL

    U->>SPA: Digita e-mail + senha
    SPA->>BFF: POST /login
    BFF->>API: Encaminha credenciais
    API->>DB: Busca usuário
    DB-->>API: Dados + hash da senha

    alt Senha incorreta
        API-->>SPA: ❌ 401 — mensagem de erro
    else Senha correta
        API->>API: Gera tokens JWT
        API-->>BFF: ✅ Tokens + dados do usuário
        BFF->>BFF: Guarda tokens em cookies<br/>HTTP-Only (invisíveis ao JS)
        BFF-->>SPA: Só os dados do usuário<br/>(SEM tokens!)
        SPA-->>U: Redireciona ao dashboard
    end
```

### Como explicar (45 segundos)

1. O usuário digita e-mail e senha; o front envia ao **BFF**.
2. O BFF repassa ao **FastAPI**, que busca o usuário no banco e **compara a senha com o hash** (bcrypt — a senha nunca é guardada em texto).
3. Senha correta → a API gera **2 tokens JWT**: um de acesso (1h) e um de renovação (7 dias).
4. **Ponto-chave:** o BFF guarda os tokens em **cookies HTTP-Only** e devolve ao navegador **apenas os dados do usuário** — o JavaScript nunca toca no token.

**Frase de impacto:** *"Mesmo que um script malicioso rode no navegador (ataque XSS), ele não consegue roubar o token, porque o token nunca chega ao JavaScript."*

---

## 3️⃣ Silent Refresh — Renovação Automática da Sessão

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant BFF as BFF Express
    participant API as FastAPI

    SPA->>BFF: GET /projetos<br/>(token de acesso EXPIROU ⏰)
    BFF->>BFF: Detecta: access expirado,<br/>refresh ainda válido

    Note over BFF,API: Renovação invisível ao usuário

    BFF->>API: Pede novo token<br/>(usa o refresh token)
    API-->>BFF: ✅ Novo access token
    BFF->>BFF: Atualiza o cookie

    BFF->>API: Repete a requisição original
    API-->>BFF: 200 — lista de projetos
    BFF-->>SPA: Dados entregues normalmente

    Note over SPA: Usuário nem percebeu! 🪄
```

### Como explicar (30 segundos)

1. O token de acesso dura só **1 hora** (por segurança). O de renovação dura **7 dias**.
2. Quando o de 1h expira, o **BFF resolve sozinho**: usa o refresh token para pedir um novo access token à API, atualiza o cookie e **repete a requisição original** — tudo na mesma chamada.
3. Para o usuário, nada aconteceu: a tela carrega normalmente, **sem deslogar e sem pedir senha de novo**.
4. Só quando os 7 dias do refresh expiram é que o sistema pede login novamente.

**Frase de impacto:** *"Token curto dá segurança; refresh automático dá conforto. O usuário fica 7 dias logado, mas um token roubado só vale por 1 hora."*

---

## 4️⃣ DER — Modelo do Banco de Dados

```mermaid
erDiagram
    USUARIOS ||--o{ CLIENTES : cadastra
    USUARIOS ||--o{ SERVICOS : oferece
    CLIENTES ||--o{ PROJETOS : contrata
    SERVICOS ||--o{ PROJETOS : compoe
    PROJETOS ||--o{ PAGAMENTOS : gera

    USUARIOS {
        int id PK
        string username
        string email
        string password_hash
    }
    CLIENTES {
        int id PK
        int usuario_id FK
        string nome
        string empresa
    }
    SERVICOS {
        int id PK
        int usuario_id FK
        string nome
        string descricao
    }
    PROJETOS {
        int id PK
        int cliente_id FK
        int servico_id FK
        string status
        decimal valor
        bool mensalista
    }
    PAGAMENTOS {
        int id PK
        int projeto_id FK
        decimal valor
        date data
    }
```

### Como explicar (45 segundos)

São **5 tabelas** que contam a história do negócio:

1. **USUARIOS** — o freelancer dono da conta. Tudo no sistema pertence a um usuário (*multitenant*: um usuário nunca vê dados do outro).
2. **CLIENTES** — quem contrata o freelancer.
3. **SERVICOS** — o que o freelancer oferece (ex: "criação de site").
4. **PROJETOS** — a tabela central: junta **um cliente + um serviço**, com status, valor e se é mensal ou avulso.
5. **PAGAMENTOS** — cada cobrança gerada por um projeto.

**Frase de impacto:** *"Um projeto é a união de um cliente com um serviço — e cada projeto gera seus pagamentos. Todo registro tem soft delete: nada é apagado de verdade, o histórico é preservado."*

---

## Sugestão de roteiro dos slides

| Slide | Conteúdo | Tempo |
|---|---|---|
| 1 | O que é o WorkMy (problema + solução) | 30s |
| 2 | Arquitetura (diagrama 1) | 30s |
| 3 | Login seguro (diagrama 2) | 45s |
| 4 | Silent refresh (diagrama 3) | 30s |
| 5 | Banco de dados (diagrama 4) | 45s |
| 6 | Tecnologias: React, Node/Express, FastAPI, PostgreSQL, Docker | 20s |

**Dica:** cole os blocos `mermaid` em [mermaid.live](https://mermaid.live) e exporte como PNG para os slides.

---

## Onde está o detalhe completo de cada diagrama

| Resumo aqui | Versão completa |
|---|---|
| Arquitetura | [06_CODIGO_SISTEMA.md](./06_CODIGO_SISTEMA.md) |
| Login + silent refresh + logout | [01_DIAGRAMA_SEQUENCIA_LOGIN.md](./01_DIAGRAMA_SEQUENCIA_LOGIN.md) |
| CRUD completo | [02_DIAGRAMA_SEQUENCIA_CRUD.md](./02_DIAGRAMA_SEQUENCIA_CRUD.md) |
| Casos de uso | [03_DIAGRAMA_CASOS_DE_USO.md](./03_DIAGRAMA_CASOS_DE_USO.md) |
| DER completo + ORM | [04_DER_ORM_SQL.md](./04_DER_ORM_SQL.md) |
