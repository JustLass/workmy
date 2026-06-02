# 📐 Plano de Ação - Edge Tier: BFF Proxy de Segurança & Cookies HTTP-Only

> [!NOTE]
> **STATUS: CONCLUÍDO (MAIO 2026)**
> O Node.js BFF foi implementado com sucesso utilizando o Express. As configurações de Cookies Seguros `HTTP-Only` foram homologadas e o React agora funciona perfeitamente sem JWT no localStorage.

Este plano de ação detalha como aplicar o **Edge Tier (BFF & Proxy de Segurança)** e o **Cache de Borda (Redis)** na camada do frontend do **WorkMy**, fechando com chave de ouro as 5 divisões lógicas da nossa arquitetura descentralizada.

---

## 🧭 1. Escopo e Racional de Segurança

Atualmente, o frontend React SPA salva o JWT no `localStorage`. Embora simples, essa abordagem é vulnerável a ataques **XSS (Cross-Site Scripting)**: se um script invasor rodar no browser, ele pode coletar o token e sequestrar a conta do freelancer.

### O Padrão BFF (Backend-For-Frontend)
Para blindar o sistema, introduziremos um servidor intermediário leve em **Node.js** (BFF Proxy) entre o browser do cliente e a nossa API FastAPI.
*   O React SPA se comunica apenas com o BFF usando caminhos relativos locais (`/api/*`).
*   O BFF intercepta as chamadas de autenticação e armazena os tokens JWT em cookies criptografados protegidos pelas diretivas **`HTTP-Only`**, **`Secure`** e **`SameSite=Strict`**.
*   **Segurança Máxima:** A diretiva `HTTP-Only` impede fisicamente que qualquer Javascript no navegador (mesmo scripts maliciosos) leia o conteúdo dos cookies. Os tokens ficam inacessíveis no browser, mas o navegador os anexa automaticamente em todas as requisições de rede.
*   O BFF lê os cookies, descriptografa o JWT, adiciona o cabeçalho `Authorization: Bearer <token>` e encaminha a requisição em segundo plano para o `backend-fastapi`.

---

## 🗂️ 2. Mapeamento de Diretórios e Estrutura de Pastas

O novo servidor BFF residirá em uma pasta isolada chamada `/bff` dentro do diretório `/frontend`:

```
frontend/
├── bff/                         # [NEW] Pasta isolada do Edge Tier
│   ├── server.js                # Arquivo principal do servidor de borda BFF
│   └── package.json             # Dependências (express, cookie-parser, http-proxy-middleware)
│
├── src/
│   ├── state/
│   │   └── AuthContext.tsx      # [MODIFY] Remove armazenamento de token no localStorage
│   ├── hooks/
│   │   └── useApi.ts            # [MODIFY] Simplifica chamada de rede
│   └── lib/
│       └── http.ts              # [MODIFY] Adiciona credentials: 'include'
│
├── vite.config.ts               # [MODIFY] Configura o Proxy local para apontar /api para o BFF
└── package.json
```

---

## ⚡ 3. Funcionamento Técnico do BFF Proxy (server.js)

O servidor do BFF será construído em Node.js usando o **Express** e o middleware **`http-proxy-middleware`** para realizar o encaminhamento de rede de forma transparente para o FastAPI rodando na porta `8000`.

### A. Fluxo de Login (`POST /api/auth/login`)
1.  O browser envia as credenciais em texto simples via HTTPS para o BFF.
2.  O BFF intercepta e repassa para a rota `/api/auth/login/` da API FastAPI.
3.  A API FastAPI valida a senha e devolve em JSON o `access_token`, o `refresh_token` e os dados do usuário.
4.  O BFF intercepta essa resposta, assina dois cookies seguros contendo os tokens e retorna em JSON **apenas** o objeto `user` para a tela do React SPA:
    *   **Cookie `workmy_access`**: Contém o access token, validade de 1 hora, `httpOnly: true`, `secure: true`, `sameSite: 'strict'`.
    *   **Cookie `workmy_refresh`**: Contém o refresh token, validade de 7 dias, `httpOnly: true`, `secure: true`, `sameSite: 'strict'`.

### B. Fluxo de Proxy Geral (`ALL /api/*`)
1.  Para qualquer outra rota de CRUD (ex: `GET /api/clientes`), o browser dispara a chamada anexando os cookies seguros de forma automática via navegador.
2.  O BFF intercepta a chamada, extrai o JWT do cookie `workmy_access` e reconstrói a requisição injetando o cabeçalho `headers['Authorization'] = 'Bearer <JWT>'`.
3.  Encaminha a chamada para o FastAPI em segundo plano de forma invisível.
4.  Devolve a resposta em JSON puro obtida do FastAPI direto para o React.

### C. Fluxo de Silent Refresh Automático
1.  Caso o cookie `workmy_access` expire, a requisição do browser chegará sem ele ou o BFF identificará que ele venceu.
2.  O BFF intercepta o erro, lê o cookie `workmy_refresh` (se houver e for válido), faz uma chamada em segundo plano para o endpoint de renovação síncrona do FastAPI.
3.  A API de segurança FastAPI valida o refresh token e emite um novo access token.
4.  O BFF gera um novo cookie seguro `workmy_access`, conclui a requisição original que o usuário havia feito de forma invisível, e o usuário continua navegando normalmente sem telas de "Sessão expirada".

---

## ⚙️ 4. Cronograma de Implementação no Frontend

### Fase 1: Criação do Servidor BFF (Express + Proxy)
1.  Criar a pasta `frontend/bff/` e o arquivo `package.json`.
2.  Instalar dependências de produção leves: `express`, `cookie-parser`, `http-proxy-middleware`, `cors`.
3.  Escrever o arquivo `server.js` mapeando os fluxos de login, logout e proxy com suporte a cookies.

### Fase 2: Configuração de Proxy no Vite
1.  Editar `frontend/vite.config.ts` para mapear a diretiva `server.proxy` de modo que qualquer chamada contendo `/api/` no browser local seja redirecionada automaticamente para a porta `3000` (BFF local) em vez do `backend-fastapi` diretamente.

### Fase 3: Adaptação das Chamadas HTTP no React
1.  **http.ts:** Atualizar o fetch nativo do React para injetar a diretiva `credentials: 'include'`. Isso diz ao navegador para enviar e aceitar cookies SameSite de forma automática em todas as requisições.
2.  **AuthContext.tsx:** Remover todo o código associado à persistência de tokens em `localStorage` e a leitura de tokens no estado da aplicação.
3.  **useApi.ts:** Simplificar a chamada removendo tokens locais.

### Fase 4: Homologação e Validação
1.  Testar o login, criação de projetos e faturamento cronológico na nova arquitetura unificada.
2.  Validar através da ferramenta de desenvolvedor do Google Chrome (*DevTools -> Application -> LocalStorage* e *Cookies*) que os tokens JWT não estão mais acessíveis em Javascript, mas que os cookies `HTTP-Only` SameSite estão trafegando de forma transparente nas abas de Network do browser.
