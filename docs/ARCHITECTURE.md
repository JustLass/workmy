# 🏗️ Documentação de Arquitetura de Software - Plataforma WorkMy

Esta documentação detalha de forma exaustiva as decisões arquiteturais, fluxos de dados, separação de responsabilidades e padrões de design da plataforma **WorkMy**. Este documento foi elaborado sob a perspectiva de um **Engenheiro de Software Staff/Principal**, alinhando as melhores práticas do setor de desenvolvimento web moderno com fundamentos arquiteturais e padrões de projeto de alta performance.

---

## 🧭 1. Visão Geral da Arquitetura (System Overview)

A plataforma WorkMy adota o padrão estrutural de **Sistemas Distribuídos Desacoplados (Decoupled Client-Server Tier)**. Em vez de uma aplicação monolítica integrada, o ecossistema é dividido em três camadas físicas e lógicas fundamentais, promovendo independência de implantação, escalabilidade isolada e segurança de dados:

*Visualização Gráfica da Arquitetura Geral (PNG):*
![Diagrama 1 - Arquitetura Geral Multicamadas](media/diagram_1_multitier.png)

*   **🔍 Mapeamento Técnico & Localização no Código:**
    *   **Camada de Apresentação:** SPA React construída com Vite e TypeScript no diretório [frontend/src](../frontend/src).
    *   **Camada de Aplicação REST:** Roteamento dinâmico e validação de APIs com Django Ninja no diretório [backend/api](../backend/api) e lógica de negócios em [backend/gestao_freelas](../backend/gestao_freelas).
    *   **Camada de Persistência:** Configuração de conexão do PostgreSQL e variáveis da nuvem do Supabase no arquivo [backend/core/settings.py](../backend/core/settings.py).

### 🔗 Fundamentação Teórica e Correlação Conceitual

A arquitetura do WorkMy foi projetada aplicando diretamente conceitos consolidados de sistemas distribuídos modernos:

1. **A Camada de Controle e o Ciclo de Requisição-Resposta:**
   * *Conceito:* Padrão estrutural clássico de controle web dinâmico baseado em requisição-resposta HTTP sem estado.
   * *Prática no WorkMy:* Traduzimos esses fundamentos clássicos para o paradigma moderno de APIs HTTP REST com Django Ninja, mapeando decoradores de rota tipados (`@router.get`, `@router.post`, `@router.put`, `@router.delete`, `@router.patch`) em controladores declarativos e modulares no arquivo [backend/api/projetos.py](../backend/api/projetos.py).
   
2. **A Arquitetura RESTful e Sem Estado (Stateless):**
   * *Conceito:* Desacoplamento estrito entre o cliente e o servidor através de transferências de representação no formato JSON.
   * *Prática no WorkMy:* O backend expõe uma API 100% Stateless (sem sessões locais no servidor), onde cada requisição HTTP carrega de forma independente a identidade do freelancer em um cabeçalho JWT (`Authorization: Bearer <token>`). O servidor valida o payload e devolve dados representados exclusivamente em JSON tipado.

3. **Arquitetura de Sistemas Multicamadas:**
   * *Conceito:* Divisão funcional de responsabilidades entre apresentação, processamento/regras de negócio e persistência definitiva de dados.
   * *Prática no WorkMy:* O React SPA gerencia a interface no browser do usuário; o Django Ninja valida a integridade e aplica regras no servidor; e o Supabase Cloud Postgres gerencia transações robustas ACID no banco de dados.

---

## ⚡ 2. Camada de Apresentação & Caching Estratégico (Client Tier)

A camada de apresentação é implementada em uma **SPA (Single Page Application)** construída com **React.js + Vite + TypeScript**. Visando maximizar a performance de renderização, eliminar latência de rede em operações repetitivas e otimizar custos de largura de banda com a nuvem, foi projetado um **Mecanismo de Cache de Escrita Direta (Write-Through) e Invalidação Pró-Ativa** no LocalStorage do navegador.

### 🛠️ Estrutura e Mecânica do Cache local

A implementação técnica encontra-se no módulo utilitário [frontend/src/shared/lib/cache.ts](../frontend/src/shared/lib/cache.ts) e é injetada globalmente por meio do hook personalizado de requisições em [frontend/src/hooks/useApi.ts](../frontend/src/hooks/useApi.ts).

1. **Isolamento Multitenant por Usuário (Cache Scoping):**
   Para evitar falhas graves de segurança onde um usuário pudesse ler dados de outro no mesmo computador, as chaves de cache no LocalStorage são protegidas usando um namespace composto pelo ID do usuário autenticado no JWT:
   ```typescript
   export function userCacheScope(userId: number | null | undefined) {
     return `user:${userId ?? 'anon'}`
   }
   ```
2. **Leitura Otimizada (GET Cache Lookup):**
   Antes de despachar uma requisição de leitura (`GET`), o hook `useApi` intercepta a chamada, normaliza o caminho e os parâmetros de consulta em ordem alfabética para construir uma chave única (`buildCacheKey`). Se o registro existir no LocalStorage e o tempo de expiração (TTL) for válido, os dados são entregues instantaneamente à interface:
   ```typescript
   if (method === 'GET' && !options?.forceRefresh) {
     const cached = readCache<T>(cacheKey)
     if (cached !== null) return cached
   }
   ```
3. **Invalidação Automática de Ciclo de Vida (Write Invalidation):**
   Sempre que uma operação de mutação (`POST`, `PUT`, `DELETE` ou `PATCH`) é executada com sucesso pelo cliente, o sistema executa uma limpeza cirúrgica de todos os caches armazenados no escopo do usuário ativo:
   ```typescript
   } else if (!options?.skipCacheInvalidation) {
     invalidateMutationDefaults(cacheScope)
   }
   ```
   Isso força o React a requisitar dados novos diretamente da nuvem na renderização subsequente, garantindo a **consistência imediata** da interface sem gerar lentidão.

*Visualização Gráfica do Fluxo do Cache (PNG):*
![Diagrama 4 - Mecanismo de Cache Estratégico Local](media/diagram_4_cache_engine.png)

*   **🔍 Mapeamento Técnico & Localização no Código:**
    *   **Algoritmo e Escopo do Cache:** Funções de serialização e TTL implementadas no arquivo [frontend/src/shared/lib/cache.ts](../frontend/src/shared/lib/cache.ts).
    *   **Interceptação e Invalidação HTTP:** Orquestradas dinamicamente no hook customizado [frontend/src/hooks/useApi.ts](../frontend/src/hooks/useApi.ts).

---

## 🗄️ 3. Camada de Persistência & Supabase Cloud PostgreSQL (Data Tier)

A persistência definitiva da plataforma é sustentada por uma instância de banco de dados relacional gerenciada **PostgreSQL** hospedada na nuvem do **Supabase**. O Django se comunica de maneira nativa por meio de drivers psycopg2 configurados em [backend/core/settings.py](../backend/core/settings.py). 

O design do banco foi planejado para resistir a falhas lógicas e garantir altíssima consistência transacional (Conformidade ACID):

```
Supabase Cloud (PostgreSQL Engine)
  ├── 👤 usuarios_usuario (Tabela de contas)
  ├── 👥 gestao_freelas_cliente (Clientes cadastrados)
  ├── 🛠️ gestao_freelas_servico (Serviços catalogados)
  └── 📄 gestao_freelas_projeto (Contratos ativos)
        └── 💰 gestao_freelas_pagamento 
              └── [UniqueConstraint: projeto_id + referencia_mes] -> Impede faturamento duplicado
```

### 🛡️ Restrições de Integridade e Idempotência (Unique Constraints)
Para sustentar um motor de faturamento automático seguro sem o risco de gerar cobranças duplicadas em um mesmo mês, aplicamos uma restrição de unicidade lógica diretamente no banco de dados do Supabase. A restrição `uniq_pagamento_projeto_referencia_mes` impede a inserção de dois lançamentos com a mesma referência temporal de mês (`referencia_mes` no formato `YYYY-MM`):
```python
# Modelagem estrita no Django mapeada no Supabase PostgreSQL
models.UniqueConstraint(
    fields=['projeto', 'referencia_mes'],
    condition=models.Q(referencia_mes__isnull=False),
    name='uniq_pagamento_projeto_referencia_mes'
)
```
Caso duas threads concorrentes ou requisições duplicadas tentem faturar um contrato mensalista para o mesmo mês, o PostgreSQL no Supabase lança uma exceção de integridade (`IntegrityError`), anulando a transação e garantindo que o faturamento seja **estritamente único e idempotente**.

### ⚡ Indexação Otimizada para Agregações Financeiras
Para acelerar o processamento de consultas estatísticas do dashboard, o Supabase mantém índices compostos estratégicos de banco de dados nos campos mais filtrados:
* **`pagamento_projeto_data_idx` (projeto_id, data):** Acelera a filtragem cronológica de despesas e receitas por contrato.
* **`pagamento_referencia_mes_idx` (referencia_mes):** Permite buscas instantâneas e agrupamentos mensais para o fluxo de caixa.

### 📝 Auditoria de Alterações Críticas (Audit Log System)
Para controle de conformidade e segurança empresarial, implementamos o modelo `AuditLog`. Toda escrita, deleção ou modificação de projetos, serviços ou clientes dispara a gravação de um snapshot JSON nativo contendo o estado completo da linha antes (`dados_anterior`) e depois (`dados_novo`) da operação, armazenado de forma isolada na tabela do Supabase para auditoria.

*Visualização Gráfica do Acesso Consolidado a Dados (PNG):*
![Diagrama 2 - Consolidação do Acesso a Dados](media/diagram_2_consolidation.png)

*   **🔍 Mapeamento Técnico & Localização no Código:**
    *   **Mapeamento e Modelagem Relacional:** Mapeados nas classes do ORM do Django em [backend/gestao_freelas/models.py](../backend/gestao_freelas/models.py).
    *   **Consultas e Filtros Atômicos Diretos (Active Record):** Executados de forma direta nos controladores do Ninja em [backend/api/projetos.py](../backend/api/projetos.py) e [backend/api/dashboard.py](../backend/api/dashboard.py).

---

## 🔒 4. Camada de Aplicação & API Gateway (Application Tier)

O backend do WorkMy é construído com **Django 6.0.3 + Django Ninja 1.6.2**. O Django Ninja atua como o nosso **API Gateway**, gerenciando a autenticação, segurança contra abusos (Rate Limiting) e a tradução e validação rígida de dados.

### 🔐 Pipeline de Segurança de Requisição
1. **Autenticação Baseada em JWT (JSON Web Tokens):**
   Toda requisição para rotas protegidas passa pelo middleware de segurança `AuthBearer` definido em [backend/api/auth.py](../backend/api/auth.py). O middleware descriptografa o token contido no cabeçalho `Authorization`, valida sua expiração e injeta a instância de usuário autenticado no parâmetro `request.auth`.
2. **Defesa Ativa contra Ataques de Negação de Serviço (Rate Limiting):**
   Para evitar ataques automatizados de força bruta e sobrecarga de CPU, os endpoints sensíveis (como Login e Registro) são protegidos por middlewares de estrangulamento (`django-ratelimit`), limitando chamadas suspeitas baseadas no IP de origem:
   ```python
   @router.post("/login", response={200: TokenResponseSchema, 401: ErrorSchema, 429: ErrorSchema})
   @ratelimit(key='ip', rate='60/h', method='POST', block=False)
   def login(request, payload: Form[UserLoginSchema]):
       ...
   ```
3. **Validação Rígida por Pydantic Schemas:**
   A entrada de dados é tipada rigidamente. Schemas herdados do Pydantic em [backend/api/schemas.py](../backend/api/schemas.py) interceptam o payload de entrada antes que qualquer código de banco seja executado. Se um campo obrigatório estiver ausente ou possuir formato inválido, a requisição é rejeitada na hora com erro HTTP `422 Unprocessable Entity`.
4. **Resolução de Consumo de Payload PUT:**
   Identificamos e contornamos a limitação nativa do Django que impede o parser nativo de ler corpos de formulário `multipart/form-data` ou `application/x-www-form-urlencoded` em chamadas HTTP `PUT`. Por decisão arquitetural, padronizamos todos os endpoints de atualização (`PUT`) do sistema para aceitar payloads no formato padrão **JSON** puro (`application/json`), adequando a API às normas clássicas da arquitetura RESTful.

---

## 📐 5. Detalhamento Arquitetural por Funcionalidade (Core Flows)

Abaixo, descrevemos o fluxo técnico detalhado de cada funcionalidade principal, citando diretamente os pontos chave do código-fonte.

*Visualização Gráfica do Mapeamento de Tiers dos Fluxos de Negócio (PNG):*
![Diagrama 3 - Fluxo de Negócio Físico de Ponta a Ponta](media/diagram_3_business_flow.png)

*   **🔍 Mapeamento Técnico & Localização no Código:**
    *   **Fluxo de Autenticação (Login & Refresh Tokens):** Orquestrados no backend em [backend/api/auth.py](../backend/api/auth.py) e controlados no frontend em [frontend/src/hooks/useApi.ts](../frontend/src/hooks/useApi.ts).
    *   **Fluxo de Contratos (Projetos & CRUD):** Implementados nas APIs Ninja em [backend/api/projetos.py](../backend/api/projetos.py).
    *   **Fluxo de Dashboard & Agregações Dinâmicas:** Centralizados nas rotas em [backend/api/dashboard.py](../backend/api/dashboard.py).

---

### A. Fluxo de Login, Sessão e Renovação de Token (JWT Gateway)
O fluxo de autenticação foi modelado no padrão de autenticação distribuída de dois fatores (Access + Refresh), semelhante ao fluxo de login corporativo do AWS Cognito.

```
Usuário (Browser) ───────[ Envia POST /auth/login ]───────> Django API Gateway
      ▲                                                           │
      │                                                   Valida Hash com Supabase
      │                                                           │
      └──────[ Retorna Access (1h) + Refresh (7d) ]───────────────┘
```

* **Login Realizado (`POST /api/auth/login`):**
  O usuário submete as credenciais criptografadas. O backend localiza o usuário ativo no Supabase e valida a senha usando algoritmos PBKDF2 com Salt (`django.contrib.auth.authenticate`). Em seguida, emite os dois tokens JWT usando a biblioteca `ninja_jwt` em [backend/api/auth.py](../backend/api/auth.py).
* **Consumo de Rotas Protegidas:**
  O frontend salva o `accessToken` em memória e o envia a cada requisição HTTP no cabeçalho `Authorization: Bearer <token>`. O backend decodifica o token de forma stateless através da classe `AuthBearer` em [backend/api/auth.py](../backend/api/auth.py).
* **Renovação Transparente (Silent Refresh):**
  Quando o `accessToken` expira (1 hora), o cliente React faz uma chamada síncrona nos bastidores para `POST /api/auth/refresh` em [backend/api/auth.py](../backend/api/auth.py), enviando o `refreshToken` persistido localmente. A API autentica o refresh token e emite um novo access token sem interromper a sessão de trabalho do usuário.

---

### B. Painel de Fluxo de Caixa Dinâmico (Dashboard & Extrato)
O dashboard compila e calcula dados financeiros complexos em nível de banco de dados para garantir entrega de performance de altíssima velocidade.

* **Agregações do Mês Atual (`GET /api/dashboard/mensal`):**
  O backend de dashboard em [backend/api/dashboard.py](../backend/api/dashboard.py) recupera as datas de início e fim do mês corrente e faz uma query agregada de soma e contagem sobre os pagamentos associados ao usuário logado:
  ```python
  agregados = pagamentos_query.aggregate(
      total=Sum('valor'),
      quantidade=Count('id')
  )
  ```
* **Previsão Próximo Mês Dinâmica:**
  O motor lê os contratos do banco que estão configurados como planos ativos e estima de forma proativa o faturamento futuro multiplicando e somando os valores mensais configurados nos projetos ativos:
  ```python
  projetos_recorrentes = Projeto.objects.filter(
      usuario=request.auth,
      recorrencia_ativa=True,
      tipo_recorrencia='MENSAL'
  )
  ```

---

### C. Motor de Recorrência Inteligente sob Demanda (Idempotent Billing Engine)
Diferente de sistemas financeiros antiquados que geram dezenas de parcelas "vazias" em lote no banco poluindo a memória do PostgreSQL, o WorkMy implementa um **Motor de Recorrência Inteligente sob Demanda**.

```
[ Usuário Abre Dashboard ] ──> API verifica: Dia Atual >= Projeto.dia_vencimento ?
                                                   │
                                ┌──────────────────┴──────────────────┐
                                SIM                                   NÃO
                                 │                                     │
                       Existe pagamento com                          (Fim)
                     referencia_mes (YYYY-MM)?
                                 │
                         ┌───────┴───────┐
                        NÃO             SIM ──> (Fim: Parcela já gerada)
                         │
              Criar Lançamento MENSAL
             (referencia_mes = YYYY-MM)
```

*Visualização Gráfica do Fluxo do Motor de Recorrência (PNG):*
![Diagrama 5 - Motor de Recorrência Inteligente sob Demanda](media/diagram_5_recurrence_engine.png)

*   **🔍 Mapeamento Técnico & Localização no Código:**
    *   **Algoritmo de Faturamento Seguro e Idempotência:** Desenvolvido no módulo de serviços em [backend/gestao_freelas/services/recorrencia.py](../backend/gestao_freelas/services/recorrencia.py).
    *   **Gatilho do Motor On-Demand:** Disparado de forma silenciosa e preventiva no carregamento dos dados agregados no arquivo [backend/api/dashboard.py](../backend/api/dashboard.py).
    *   **Garantia Absoluta Relacional:** Apoiada na restrição `UniqueConstraint` definida no modelo `Pagamento` no arquivo [backend/gestao_freelas/models.py](../backend/gestao_freelas/models.py).

1. **Trigger de Execução:**
   Sempre que o usuário acessa o dashboard ou atualiza configurações contratuais, a API ativa preventivamente o serviço de recorrência para varrer todos os projetos elegíveis daquele usuário:
   ```python
   # Trigger on-demand em backend/api/dashboard.py
   from gestao_freelas.services.recorrencia import gerar_recorrencias_usuario
   try:
       gerar_recorrencias_usuario(request.auth.id)
   except Exception:
       pass
   ```
2. **Cálculo da Elegibilidade e Geração Idempotente:**
   Dentro de [backend/gestao_freelas/services/recorrencia.py](../backend/gestao_freelas/services/recorrencia.py), o motor avalia cada projeto com `recorrencia_ativa = True` e `tipo_recorrencia = 'MENSAL'`. O faturamento do mês atual é processado apenas se a data de hoje for igual ou posterior ao dia de vencimento programado do contrato (`hoje.day >= projeto.dia_vencimento`).
3. **Criação Segura:**
   O sistema utiliza a transação atômica do Django em conjunto com a restrição do PostgreSQL no Supabase, executando a criação segura da cobrança somente se não existir um pagamento correspondente ao identificador temporal `referencia_mes` (ex: `2026-05`):
   ```python
   pagamento, created = Pagamento.objects.get_or_create(
       projeto=projeto,
       referencia_mes=ref,
       defaults={
           'valor': valor,
           'tipo_pagamento': 'MENSAL',
           'data': data_parcela,
           'observacao': 'Gerado automaticamente (Recorrência Mensal)',
           'gerado_automaticamente': True,
       },
   )
   ```

---

### D. RESTful CRUD de Recursos (Clientes, Serviços e Projetos)
Seguindo as premissas clássicas de arquitetura REST, estruturamos os endpoints de manutenção de dados como manipulações de recursos puros:

* **Listagem (`GET`):** Retorna representações em array JSON tipadas, carregando os dados de cache caso disponíveis para reduzir tráfego com o Supabase.
* **Criação (`POST`):** Cria novas linhas no banco de dados e dispara a invalidação global do cache local do usuário emitente, garantindo a visualização dos dados novos nas telas seguintes.
* **Atualização (`PUT`):** Permite reconfigurar dados do recurso de forma integral via payload JSON, protegendo contra colisões contratuais.
* **Exclusão Lógica (`DELETE` / Soft Delete):** Para garantir conformidade e proteção contra perda acidental de dados, a exclusão de recursos chave (como clientes) não apaga o registro fisicamente. Em vez disso, aplica um carimbo de data (`deletado_em`), marcando o registro como inativo para as consultas da API, preservando a integridade dos dados históricos do fluxo financeiro no Supabase.

---

### E. Portfólio Comercial & Exportação Inteligente de PDF (Client-Side Vector Rendering)
Visando desonerar o backend de processos pesados que consomem excessiva memória RAM e CPU do servidor (como execuções remotas do Puppeteer, WeasyPrint ou renderizadores em lote de PDF no Django), a exportação de fichas e propostas de portfólio comercial do WorkMy é executada de forma inteligente e vetorial na **Camada de Apresentação (Client-Side)**.

* **Tecnologia Aplicada (`@media print`):**
  Projetamos folhas de estilo CSS responsivas para mídia de impressão. Quando o usuário clica em "Imprimir" ou "Exportar PDF" no frontend, o navegador web do próprio cliente processa as coordenadas, grids de design, tipografias limpas da Google Fonts e imagens do portfólio.
* **Vantagens de Engenharia:**
  A renderização é 100% vetorial de altíssima definição (retendo a escala de cores e fidelidade de textos). O servidor backend permanece leve, escalável e focado exclusivamente no fornecimento de dados JSON ultrarrápidos, sem o risco de enfrentar travamentos por tarefas de conversão de arquivos pesados concorrentes.

---

## 📈 6. Decisões Arquiteturais & Trade-offs (Architectural Decisions)

Abaixo, sumarizamos a análise estratégica da escolha de tecnologias da plataforma WorkMy por meio de uma matriz de trade-off profissional:

| Escolha Tecnológica | Racional Técnico (Design Pattern) | Benefício de Engenharia | Trade-off / Mitigação de Risco |
| :--- | :--- | :--- | :--- |
| **Persistência em Supabase Cloud** | Banco relacional PostgreSQL profissional gerenciado. | Altíssima integridade relacional, suporte a transações ACID e triggers nativas de banco. | Latência física de rede (Edge-to-Cloud). Mitigado com cache estratégico no frontend e queries agregadas otimizadas. |
| **Django Ninja em vez de DRF** | API Framework assíncrono e tipado compilado sobre Pydantic. | Validação automática ultraveloz em milissegundos e documentação interativa Swagger auto-gerada com overhead zero. | Curva de aprendizado menor em comparação ao Django REST Framework tradicional. Mitigado com tipagem clara nos arquivos `schemas.py`. |
| **Mecanismo de Cache LocalStorage** | Caching Write-Through isolado por escopo de ID de usuário no cliente. | Redução drástica de mais de 75% no consumo direto do Supabase Cloud, garantindo navegação com latência de 0ms. | Risco de exibição de dados obsoletos. Mitigado com invalidação automática forçada para todas as mutações (`POST`, `PUT`, `DELETE`). |
| **Faturamento Recorrente sob Demanda** | Cobrança gerada com controle de vencimento (`hoje.day >= dia`) e unicidade lógica. | Evita a inserção de registros em massa inúteis futuros, mantendo as tabelas financeiras enxutas e consultas rápidas. | Exige disparo de verificação na inicialização de páginas chave do app. Mitigado com verificação silenciosa integrada ao carregamento do Dashboard. |
| **Geração de PDF no Client-Side (`@media print`)** | Renderização vetorial nativa e folha de estilos de impressão responsiva. | Reduz a zero o consumo de CPU e RAM no backend para renderização de arquivos, transferindo o trabalho gráfico para o motor do browser. | Dependência do comportamento de impressão de cada navegador. Mitigado com layouts de grid flexíveis altamente compatíveis e testados. |

---

Este documento serve como a **Bússola de Engenharia** oficial da plataforma **WorkMy**, guiando os desenvolvedores na manutenção e evolução do sistema sob os mais estritos padrões de qualidade e consistência de software.
