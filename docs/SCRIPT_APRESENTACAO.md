# 🎙️ Roteiro de Apresentação Oral - Arquitetura de Software WorkMy

Este documento contém o **script de fala (roteiro do apresentador)** detalhado slide a slide para guiar o grupo (**Rafael, Victor e Eric**) durante a apresentação na TV ou projetor. O tempo estimado total de apresentação é de **8 a 10 minutos** (cerca de 45 a 50 segundos por slide).

---

## 🖥️ Slide 1: Capa da Apresentação
*   **Visual na tela:** Logotipo do WorkMy, título "Apresentação da Arquitetura de Software", nomes dos autores.
*   **Tempo estimado:** 30 a 45 segundos.
*   **Quem apresenta (Sugestão):** Rafael.
*   **O que falar:**
    > *"Olá a todos, boa noite. Gostaria de dar as boas-vindas à nossa apresentação de arquitetura do **WorkMy**, uma plataforma de gestão financeira especificamente projetada para atender às necessidades dinâmicas de freelancers e prestadores de serviços. Meu nome é **Rafael**, e ao meu lado estão o **Victor** e o **Eric**. Hoje, nós iremos detalhar como estruturamos a engenharia de software do WorkMy, passando pelo desacoplamento físico e lógico das camadas, o uso estratégico de cache local de baixíssima latência, integridade relacional na nuvem e o motor de faturamento automático sob demanda e altamente seguro."*

---

## 🖥️ Slide 2: 1. Visão Geral da Arquitetura (Teoria)
*   **Visual na tela:** Detalhes conceituais das 3 camadas e localização dos arquivos `/frontend/src`, `/backend/api` e `settings.py`.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Rafael.
*   **O que falar:**
    > *"Para dar início, a nossa plataforma adota o padrão de **Sistemas Distribuídos Desacoplados**. Em vez de criarmos um monólito tradicional, dividimos o ecossistema em três camadas totalmente independentes de deploy, promovendo isolamento físico e lógico. A nossa Camada de Apresentação é uma SPA construída em React com TypeScript, responsável apenas pela exibição e interação. Ela se conecta de forma stateless à nossa Camada de Aplicação, que é uma API Gateway construída em Django Ninja no Python. Por fim, a persistência ocorre na Camada de Dados na nuvem do Supabase, que gerencia o nosso PostgreSQL. O código do front-end está isolado na pasta `frontend/src`, as rotas do backend na pasta `backend/api`, e a conexão com a nuvem mapeada em `settings.py`."*

---

## 🖥️ Slide 3: Diagrama Geral da Arquitetura
*   **Visual na tela:** **Diagrama 1** inteiro com as conexões HTTP/JSON e conexões ORM SQL.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Rafael.
*   **O que falar:**
    > *"Neste diagrama, podemos visualizar perfeitamente o fluxo de dados em tempo de execução. O usuário atua diretamente no browser executando o React Client. Quando uma ação ocorre, a camada de apresentação despacha uma requisição HTTP REST encapsulando dados em formato JSON e portando a credencial JWT no cabeçalho. No backend, a API intercepta a requisição, realiza a validação estrita dos tipos de dados de entrada usando Schemas do Pydantic, aplica as regras internas e, em seguida, dispara comandos de busca ou escrita atômicos no PostgreSQL hospedado no Supabase via Django ORM. O resultado do banco retorna ao backend, é estruturado e devolvido em JSON para o cliente."*

---

## 🖥️ Slide 4: 2. Camada de Apresentação & Caching Estratégico (Teoria)
*   **Visual na tela:** Conceito de cache isolado por usuário, leitura GET de 0ms e invalidação automática por mutações.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Victor.
*   **O que falar:**
    > *"Passando agora para a nossa Camada de Apresentação, um dos grandes desafios de sistemas web modernos é mitigar a latência de rede e otimizar as consultas ao banco de dados em nuvem. Para resolver isso no WorkMy, projetamos um **Mecanismo de Cache de Escrita Direta (Write-Through) com Invalidação Pró-Ativa** no LocalStorage do navegador. O mecanismo é 100% seguro: ele segmenta o cache sob o namespace do ID do usuário ativo, impedindo que contas diferentes na mesma máquina vejam dados uma da outra. As consultas GET normais são resolvidas localmente de forma instantânea em 0ms se o TTL estiver ativo, poupando rede. E para garantir consistência imediata, qualquer escrita como POST, PUT ou DELETE limpa esse cache de forma pró-ativa."*

---

## 🖥️ Slide 5: Diagrama do Mecanismo de Cache Local
*   **Visual na tela:** **Diagrama 4** exibindo os caminhos lógicos de HIT e MISS na leitura, e a purga nas mutações.
*   **Tempo estimado:** 45 segundos.
*   **Quem apresenta (Sugestão):** Victor.
*   **O que falar:**
    > *"Como podemos observar graficamente no diagrama à direita da tela, dividimos o fluxo entre leitura e escrita. No fluxo GET, a UI faz a solicitação e o hook `useApi` intercepta. Se houver 'HIT' e o cache estiver ativo, os dados são entregues à tela imediatamente sem fazer nenhuma requisição de rede. Havendo 'MISS', a API na nuvem é consultada e o resultado é salvo localmente para as próximas consultas. À direita, vemos o fluxo de escrita: sempre que a interface envia uma alteração, ela é processada pela API e o sistema dispara a invalidação dos caches locais do usuário, mantendo a interface reativa e sempre atualizada."*

---

## 🖥️ Slide 6: 3. Camada de Persistência & Supabase Cloud (Teoria)
*   **Visual na tela:** PostgreSQL gerenciado no Supabase, Unique Constraints de Idempotência e Auditoria JSONB.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Victor.
*   **O que falar:**
    > *"Agora falaremos sobre a nossa Camada de Persistência de Dados. Escolhemos o PostgreSQL gerenciado na nuvem do Supabase como nossa âncora de segurança relacional. O banco foi estruturado de forma estrita respeitando transações atômicas sob a conformidade ACID. Para blindar a plataforma contra falhas lógicas e concorrência, implementamos restrições físicas de unicidade lógica, como a `uniq_pagamento_projeto_referencia_mes`, que impede a gravação física de parcelas duplicadas. E para controle e conformidade do sistema, criamos uma tabela de Auditoria chamada `AuditLog` que armazena snapshots em JSONB registrando o estado completo antes e depois de cada alteração em clientes, projetos e serviços."*

---

## 🖥️ Slide 7: Diagrama de Consolidação de Acesso a Dados
*   **Visual na tela:** **Diagrama 2** comparando o modelo clássico de múltiplas camadas DAO com o modelo otimizado do WorkMy.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Victor.
*   **O que falar:**
    > *"Este slide ilustra uma decisão arquitetural fundamental. À esquerda, vemos a arquitetura tradicional adotada em muitos sistemas legados, onde o Acesso a Dados é isolado em um microsserviço físico ou camada DAO separada na rede, o que gera quebras de contexto e alta latência física de rede na nuvem. À direita, vemos a nossa arquitetura otimizada e consolidada no WorkMy. Eliminamos camadas intermediárias repetitivas de DAO e integramos o acesso de dados diretamente às APIs REST do Django Ninja por meio do ORM do Django. Isso centraliza as validações nos Schemas Pydantic e garante performance atômica e desenvolvimento extremamente limpo."*

---

## 🖥️ Slide 8: 4. Camada de Aplicação & APIs (Teoria)
*   **Visual na tela:** JWT duplo fator, validação de payloads com Pydantic, rate limiting e padronização JSON no PUT.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Eric.
*   **O que falar:**
    > *"Agora, detalhando a nossa Camada de Aplicação, estruturamos a API Gateway do WorkMy focada em segurança de requisição. A autenticação é baseada em JWT com ciclo duplo: um token de acesso rápido de 1 hora para rotas stateless e um token de refresh de 7 dias armazenado com segurança para renovações silenciosas de sessão. Além disso, defendemos as rotas críticas de login contra força bruta aplicando Rate Limiting por IP. O Django Ninja tipa as entradas rigidamente usando Schemas do Pydantic, garantindo que payloads fora do formato padrão sejam rejeitados de imediato com erro HTTP 422, antes de interagir com o banco de dados."*

---

## 🖥️ Slide 9: Diagrama de Fluxo Físico de Ponta a Ponta
*   **Visual na tela:** **Diagrama 3** detalhando os fluxos multi-tier para Login, Projetos, Recorrências e Dashboard.
*   **Tempo estimado:** 50 a 60 segundos.
*   **Quem apresenta (Sugestão):** Eric.
*   **O que falar:**
    > *"Neste diagrama de fluxo físico, mapeamos a jornada dos dados através das 4 divisões físicas da aplicação. No topo, vemos o fluxo de Autenticação, onde credenciais submetidas no formulário de login batem no controller Django Ninja, validam a chave relacional com o Supabase e devolvem os tokens JWT. No segundo fluxo, o gerenciamento de Projetos e Kanban do cliente dispara chamadas de escrita atômica no banco de dados. Abaixo, no terceiro fluxo, temos a Recorrência Financeira, que é disparada automaticamente no backend no carregamento do Dashboard. E no último fluxo, as consultas de fluxo de caixa efetuam buscas agregadas e somas de valores na nuvem."*

---

## 🖥️ Slide 10: 5. Motor de Recorrência Inteligente sob Demanda (Teoria)
*   **Visual na tela:** Faturamento sob demanda, vigência, cálculo de elegibilidade e o double-lock idempotente.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Eric.
*   **O que falar:**
    > *"Um dos maiores diferenciais técnicos da nossa plataforma é o **Motor de Recorrência Inteligente**. Sistemas financeiros obsoletos geram dezenas de parcelas e faturas em lote antecipadamente no banco, poluindo as tabelas do PostgreSQL com registros vazios. No WorkMy, a criação é 100% sob demanda e ativada em tempo de execução quando o usuário acessa o dashboard. O motor varre os contratos ativos do usuário, analisa a elegibilidade baseando-se no vencimento do contrato contra o dia atual e, caso a parcela do mês vigente no formato YYYY-MM ainda não exista, ela é criada de forma limpa e idempotente."*

---

## 🖥️ Slide 11: Diagrama do Motor de Recorrência
*   **Visual na tela:** **Diagrama 5** exibindo a árvore de decisões do motor de faturamento de parcelas e a proteção do banco.
*   **Tempo estimado:** 45 a 50 segundos.
*   **Quem apresenta (Sugestão):** Eric.
*   **O que falar:**
    > *"Podemos ver na tela a árvore de decisão do motor. Ao inicializar o Dashboard, a API executa silenciosamente o motor de faturamento. Ele analisa o dia atual em relação ao dia programado de vencimento do projeto. Se o vencimento foi atingido e a recorrência contratual está ativa, a inteligência consulta o Supabase buscando um pagamento existente para o identificador temporal do mês. Se a parcela já existe, o fluxo é encerrado imediatamente garantindo a idempotência. Se não existir, a parcela mensal é gerada via Django ORM. E como proteção de segurança de hardware final contra condições de corrida concorrentes, a UniqueConstraint no PostgreSQL barra fisicamente qualquer duplicidade relacional."*

---

## 🖥️ Slide 12: 6. Decisões Arquiteturais & Trade-offs (Conclusão)
*   **Visual na tela:** Tabela de trade-offs de tecnologias e mitigações de riscos e nota oficial de encerramento da bússola de engenharia.
*   **Tempo estimado:** 45 a 60 segundos.
*   **Quem apresenta (Sugestão):** Rafael.
*   **O que falar:**
    > *"Para finalizar nossa apresentação, analisamos toda a engenharia do WorkMy através desta matriz profissional de trade-offs. Toda escolha tecnológica traz benefícios e desafios inerentes. Ao usarmos o banco gerenciado no Supabase, ganhamos integridade mas enfrentamos latência edge-to-cloud, mitigada pelo nosso cache local no cliente. O Django Ninja exige tipagem declarativa de schemas, mas nos presenteou com validações automáticas de milissegundos e documentação Swagger auto-gerada de alta produtividade. E a exportação de relatórios em PDF executada no client-side via @media print zera a carga gráfica no servidor backend. Concluímos que a arquitetura do WorkMy equilibra de forma exemplar robustez, segurança e alta performance. Muito obrigado pela atenção de todos e abrimos espaço para perguntas da banca!"*
