# 🔐 Diagrama de Sequência — Autenticação (Login)

> Este documento apresenta o **Diagrama de Sequência UML** do fluxo de autenticação do sistema WorkMy, descrevendo passo a passo a interação entre os componentes desde a ação do usuário até a criação da sessão segura.

---

## 1. Visão Geral do Fluxo

O sistema WorkMy adota uma estratégia de autenticação baseada em **cookies HTTP-Only** gerenciados por um BFF (Backend For Frontend). O token JWT **nunca é exposto ao JavaScript do navegador**, mitigando ataques XSS. O fluxo completo envolve 4 participantes:

| Participante | Responsabilidade |
|---|---|
| **Usuário** | Informa credenciais (e-mail ou username + senha) |
| **React SPA** | Envia requisição ao BFF com `credentials: include` |
| **BFF (Express)** | Intercepta login, guarda tokens em cookies HTTP-Only |
| **FastAPI Core** | Valida credenciais, gera JWT (access + refresh) |
| **PostgreSQL** | Armazena hash da senha e dados do usuário |

---

## 2. Diagrama de Sequência — Login

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA<br/>(LoginPage.tsx)
    participant BFF as BFF Express<br/>(server.js)
    participant API as FastAPI Core<br/>(rest/auth.py)
    participant UC as AuthUseCases<br/>(Application Layer)
    participant REPO as UsuarioRepository<br/>(Infrastructure)
    participant DB as PostgreSQL

    Note over U,DB: FASE 1 — Envio de Credenciais

    U->>SPA: Preenche e-mail/username + senha
    SPA->>SPA: Validação local (campos obrigatórios)
    SPA->>BFF: POST /api/auth/login<br/>{email, password}<br/>credentials: include

    Note over BFF,DB: FASE 2 — BFF Intercepta e Encaminha

    BFF->>BFF: logBffAction("Auth Gateway", "POST /api/auth/login")
    BFF->>API: POST /api/auth/login<br/>{email, password}<br/>(callFastApi via HTTP interno)

    Note over API,DB: FASE 3 — Validação no Core (Hexagonal)

    API->>UC: login(email_ou_username, password_raw)
    UC->>REPO: get_by_email(email_ou_username)
    REPO->>DB: SELECT * FROM usuarios WHERE email = ?
    DB-->>REPO: Row (ou null)

    alt E-mail não encontrado
        UC->>REPO: get_by_username(email_ou_username)
        REPO->>DB: SELECT * FROM usuarios WHERE username = ?
        DB-->>REPO: Row (ou null)
    end

    alt Usuário não encontrado
        UC-->>API: NaoEncontradoException
        API-->>BFF: 401 {"detail": "E-mail ou nome de usuário não cadastrado."}
        BFF-->>SPA: 401 (erro)
        SPA-->>U: Exibe mensagem de erro
    else Usuário encontrado
        REPO-->>UC: UsuarioEntity (id, username, email, password_hash)
        UC->>UC: password_hasher.verify(password_raw, password_hash)

        alt Senha incorreta
            UC-->>API: ValidaEntidadeException
            API-->>BFF: 401 {"detail": "Senha incorreta."}
            BFF-->>SPA: 401 (erro)
            SPA-->>U: Exibe mensagem de erro
        else Senha correta
            Note over UC: FASE 4 — Emissão de Tokens JWT
            UC->>UC: token_service.create_access_token(id, username, email)
            UC->>UC: token_service.create_refresh_token(id)
            UC-->>API: (UsuarioEntity, access_token, refresh_token)
            API-->>BFF: 200 {access, refresh, user}
        end
    end

    Note over BFF,SPA: FASE 5 — BFF Guarda Tokens em Cookies

    BFF->>BFF: Set-Cookie "workmy_access"<br/>(HttpOnly, Secure, SameSite, 1h)
    BFF->>BFF: Set-Cookie "workmy_refresh"<br/>(HttpOnly, Secure, SameSite, 7d)
    BFF-->>SPA: 200 {user} (SEM tokens no body!)

    Note over SPA,U: FASE 6 — SPA Persiste Sessão Local

    SPA->>SPA: persistUser(user) no estado
    SPA->>SPA: clearApiCache() (invalida cache antigo)
    SPA-->>U: Redireciona para /dashboard
```

---

## 3. Diagrama de Sequência — Silent Refresh

Quando o **access token** (1 hora) expira mas o **refresh token** (7 dias) ainda é válido, o BFF executa a renovação **transparentemente**, sem que o usuário perceba:

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant BFF as BFF Express
    participant API as FastAPI Core

    SPA->>BFF: GET /api/projetos<br/>(cookie workmy_access expirado)
    BFF->>BFF: Detecta: access ausente,<br/>refresh presente

    Note over BFF: Silent Refresh automático

    BFF->>API: POST /api/auth/refresh<br/>{refresh: workmy_refresh}
    API->>API: Decodifica refresh token<br/>Valida tipo == "refresh"
    API->>API: Busca usuário por ID no banco
    API-->>BFF: 200 {access: "novo_jwt"}

    BFF->>BFF: Set-Cookie workmy_access (novo)
    BFF->>API: GET /api/projetos<br/>Authorization: Bearer novo_jwt
    API-->>BFF: 200 [lista de projetos]
    BFF-->>SPA: 200 [lista de projetos]

    Note over SPA,BFF: Se refresh também expirou → 401 → re-login
```

---

## 4. Diagrama de Sequência — Logout

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant BFF as BFF Express
    participant API as FastAPI Core

    U->>SPA: Clica em "Sair"
    SPA->>BFF: POST /api/auth/logout<br/>credentials: include

    BFF->>BFF: Lê cookie workmy_access
    BFF->>API: POST /api/auth/logout<br/>Authorization: Bearer access_token
    API->>API: decode_token(token)<br/>Extrai JTI
    API->>API: revoke_token(jti)<br/>Adiciona à blacklist
    API-->>BFF: 200 {"message": "Token revogado"}

    BFF->>BFF: clearCookie("workmy_access")
    BFF->>BFF: clearCookie("workmy_refresh")
    BFF-->>SPA: 200 {"message": "Sessão encerrada"}

    SPA->>SPA: Limpa estado local
    SPA-->>U: Redireciona para /login
```

---

## 5. Rastreabilidade — De onde vem cada participante no código

| Participante no Diagrama | Arquivo no Código-Fonte |
|---|---|
| React SPA (LoginPage) | `frontend/src/pages/LoginPage.tsx` |
| BFF Express (server.js) | `frontend/bff/server.js` — linhas 138-160 (login), 189-209 (logout), 216-271 (middleware) |
| FastAPI Router (auth) | `backend-fastapi/src/presentation/rest/auth.py` |
| AuthUseCases | `backend-fastapi/src/application/usecases/auth_usecases.py` |
| UsuarioRepository | `backend-fastapi/src/infrastructure/persistence/repositories/postgres_usuario_repo.py` |
| PostgreSQL | Tabela `usuarios` — definida em `backend-fastapi/src/infrastructure/persistence/models.py` (linhas 7-18) |

---

## 6. Decisões de Segurança

| Decisão | Justificativa |
|---|---|
| **JWT em cookies HTTP-Only** | O token nunca é acessível via `document.cookie` no JavaScript. Mitiga XSS. |
| **SameSite = strict (prod)** | Impede envio do cookie em requisições cross-site (CSRF). |
| **Secure = true (prod)** | Cookie só é transmitido por HTTPS. |
| **Blacklist de JTI no logout** | Permite invalidação imediata de tokens, mesmo antes de expirar. |
| **Bcrypt para hash de senha** | Algoritmo com salt automático e fator de trabalho configurável. |
| **Access 1h + Refresh 7d** | Equilíbrio entre UX (sessão longa) e segurança (janela de exposição curta). |
