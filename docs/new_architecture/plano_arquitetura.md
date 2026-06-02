# 📐 Plano de Ação - Nova Arquitetura WorkMy do Zero (FastAPI + Clean/Hexagonal)

> [!NOTE]
> **STATUS: CONCLUÍDO (MAIO 2026)**
> Toda a migração detalhada neste plano foi executada e homologada com sucesso. O backend agora roda 100% em FastAPI + Node BFF.

Este plano de ação detalha a decisão estratégica de **refazer o backend do zero**, abandonando o Django monolítico tradicional e adotando o **FastAPI** como o novo motor do sistema. 

O FastAPI é uma escolha substancialmente superior para a **Arquitetura Hexagonal (Clean/Ports & Adapters)**, pois é extremamente leve, não nos força a usar um banco de dados específico (como o ORM ativo do Django) e possui o melhor sistema de **Injeção de Dependências** nativo do ecossistema Python.

---

## 🧭 1. Escopo e Justificativa da Stack (FastAPI)

### Por que NÃO usar Django para esta arquitetura?
*   **Acoplamento por Design:** O Django é um framework opinativo de "baterias inclusas". Seu ORM segue o padrão *Active Record*, onde a definição da tabela, a validação de regras de banco e os métodos de persistência estão soldados na mesma classe. Tentar isolar o domínio no Django significa lutar constantemente contra o framework.
*   **Boilerplate Excessivo:** Para desacoplar o Django, teríamos que manter classes duplicadas de Models (Django) e Entidades (Domínio puro), além de desativar os middlewares nativos, tornando o desenvolvimento lento e complexo.

### Por que o FastAPI é a Escolha Perfeita?
*   **Framework Modular (Microframework):** O FastAPI não possui banco de dados, autenticação ou estrutura de pastas obrigatória. Ele atua estritamente como a **Camada de Entrega (HTTP API Gateway)**.
*   **Pydantic Nativo:** Assim como o Django Ninja, o FastAPI usa Pydantic v2 para validação automática de dados. A migração dos seus schemas atuais será quase instantânea.
*   **Injeção de Dependências Robusta:** O FastAPI possui o mecanismo `Depends()`, que permite injetar os adaptadores de persistência (Repositories) nos Casos de Uso em runtime de forma limpa, cumprindo o princípio de **Inversão de Dependência (D do SOLID)**.
*   **Assincronismo Nativo (async/await):** Prontidão para lidar com concorrência massiva e chamadas de fila em tempo real (RabbitMQ).

---

## 🗂️ 2. Nova Estrutura de Diretórios (FastAPI Clean Architecture)

O novo repositório backend será construído do zero sob a seguinte estrutura física modular:

```
backend-fastapi/
├── src/
│   ├── domain/                  # 1. DOMÍNIO (Regras de Negócio e Entidades Puras)
│   │   ├── entities/            # Entidades do negócio (projeto.py, cliente.py, pagamento.py, usuario.py)
│   │   ├── exceptions/          # Exceções de negócio (colisao_contrato.py, saldo_insuficiente.py)
│   │   └── value_objects/       # Objetos de valor (email.py, cpf.py)
│   │
│   ├── application/             # 2. APLICAÇÃO (Casos de Uso e Contratos de Portas)
│   │   ├── use_cases/           # Casos de Uso do Sistema (criar_projeto.py, gerar_faturamento.py)
│   │   └── ports/               # Interfaces / Contratos Abstratos (Ports)
│   │       ├── repositories/    # Interfaces de dados (i_projeto_repository.py, i_cliente_repository.py)
│   │       └── services/        # Interfaces de serviços (i_auth_service.py, i_broker_service.py)
│   │
│   ├── infrastructure/          # 3. INFRAESTRUTURA (Tecnologias e Conexões Físicas)
│   │   ├── adapters/            # Implementações Concretas das Portas
│   │   │   ├── repositories/    # Acesso a dados com SQLAlchemy ou Supabase Client (ex: postgres_projeto_repo.py)
│   │   │   ├── auth/            # Adaptador de Segurança (ex: jose_jwt_auth_service.py ou supabase_auth.py)
│   │   │   └── queue/           # Adaptador de mensageria (ex: pika_rabbitmq_publisher.py)
│   │   ├── db/                  # Configuração do banco (SQLAlchemy Session local, migrations com Alembic)
│   │   └── security/            # Criptografia, hashes, geração de chaves
│   │
│   └── presentation/            # 4. APRESENTAÇÃO / DELIVERY (Interface HTTP Externa)
│       ├── api/                 # FastAPI Routers / Controllers (routers de clientes, projetos, etc.)
│       ├── schemas/             # Schemas Pydantic de entrada e saída
│       ├── middlewares/         # Middlewares de Autenticação JWT, Rate-Limiting por IP
│       └── main.py              # Ponto de entrada da aplicação FastAPI
│
├── tests/                       # 5. TESTES (Unitários e de Integração)
│   ├── domain/                  # Testes das regras de negócio puras (sem banco)
│   └── integration/             # Testes dos controllers batendo no banco local
│
├── docker-compose.yml           # Banco de dados e RabbitMQ rodando locais
├── requirements.txt             # Dependências leves (fastapi, uvicorn, sqlalchemy, pydantic, pika)
└── README.md
```

---

## 📋 3. Requisitos de Sistema

### Requisitos Funcionais (RFs)
*   **RF-01 (Autenticação JWT):** Registro e login de usuários independentes emitindo tokens de acesso (`access_token`) e de atualização (`refresh_token`).
*   **RF-02 (CRUD de Clientes):** Gestão de clientes com soft delete (`deletado_em` preenchido, mas mantido para histórico).
*   **RF-03 (CRUD de Serviços):** Tabela de serviços com valores de referência.
*   **RF-04 (CRUD de Projetos):** Criação de contratos de projetos associando um cliente e serviço.
*   **RF-05 (Prevenção de Duplicidade):** Impedir que um serviço ativo seja contratado novamente pelo mesmo cliente.
*   **RF-06 (Faturamento Recorrente sob Demanda):** Identificar projetos de tipo `MENSAL` e, quando disparado, gerar faturamento pontual do mês corrente baseando-se no dia de vencimento programado.
*   **RF-07 (Idempotência Absoluta):** Garantir que nenhum contrato mensalista receba duas faturas no mesmo mês (`referencia_mes = YYYY-MM` único por projeto).
*   **RF-08 (Dashboard Analytics):** Agregar faturamento do mês atual, volumes recebidos e previsão do faturamento do próximo mês.
*   **RF-09 (Ficha PDF Comercial):** Visualização e exportação de proposta de portfólio via estilização de impressão limpa no client-side.

### Requisitos Não Funcionais (RNFs)
*   **RNF-01 (Acoplamento Zero de Domínio):** O domínio não importa bibliotecas do FastAPI, SQLAlchemy ou JWT. É Python puro.
*   **RNF-02 (Injeção de Dependência Dinâmica):** Os controladores FastAPI devem receber os Casos de Uso com os repositórios injetados dinamicamente via `Depends()`.
*   **RNF-03 (Processamento Assíncrono):** Pub/sub de eventos secundários (ex: criação de logs de auditoria e notificações de faturamento) devem ser postados no RabbitMQ.
*   **RNF-04 (Segurança de Cookie BFF):** A SPA em React deve consumir a API por meio de cookies HTTP-Only e SameSite=Strict providos por um BFF Proxy leve para evitar vazamento de token JWT.
*   **RNF-05 (Consistência Transacional):** Todas as escritas críticas no banco de dados devem ocorrer sob transações ACID seguras.

---

## ⚡ 4. Diagrama da Arquitetura e Fluxo de Integração

```mermaid
graph TD
    subgraph Apresentação (FastAPI Delivery)
        Router[FastAPI Route] -->|Recebe Payload| PydanticSchema[Pydantic Validation Schema]
        Middleware[Auth Middleware JWT] -->|Injeta ID de Usuário| Router
    end

    subgraph Aplicação (Use Cases & Ports)
        Router -->|Chama via Injeção Depends| UseCase[CriarProjetoUseCase]
        UseCase -->|Consome Port| IRepo[IProjetoRepository Interface]
        UseCase -->|Dispara Evento Port| IPub[IEventPublisher Interface]
    end

    subgraph Infraestrutura (Adapters & DB)
        IRepo -.->|Implementação Concreta| SQLAlchemyAdapter[SQLAlchemy Postgres Adapter]
        IPub -.->|Implementação Concreta| PikaRabbitMQ[RabbitMQ Pika Adapter]
        SQLAlchemyAdapter -->|Query/Escrita| SupabaseDB[(PostgreSQL Database)]
    end
```

### O Fluxo na Prática com FastAPI:
1.  **FastAPI Route:** O endpoint recebe a requisição HTTP. O Pydantic valida a estrutura do JSON. O Middleware de segurança valida o JWT de forma rápida e injeta o `usuario_id` na rota.
2.  **Injeção de Dependência:** O FastAPI resolve as dependências e injeta o repositório concreto (`SQLAlchemyAdapter`) dentro do Caso de Uso (`CriarProjetoUseCase`).
3.  **Execução do Caso de Uso:** O Caso de Uso roda a lógica pura de negócio. Ele interage com o banco de dados usando a interface `IRepo`.
4.  **Processamento Assíncrono de Eventos:** Após gravar o projeto com sucesso no banco de dados, o Caso de Uso chama a porta `IPub` para enviar um evento para a fila do RabbitMQ de forma assíncrona, liberando a resposta HTTP de forma ultraveloz para o usuário.

---

## ⚙️ 5. Mapeamento de Use Cases e Contratos de Código

Para demonstrar o desacoplamento supremo do FastAPI, veja como ficará a assinatura de código do Caso de Uso e das Rotas.

### Contrato de Repositório (Port)
```python
# src/application/ports/repositories/i_projeto_repository.py
from abc import ABC, abstractmethod
from src.domain.entities.projeto import ProjetoEntity

class IProjetoRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: int, usuario_id: int) -> ProjetoEntity | None:
        pass

    @abstractmethod
    async def exists_active_contract(self, cliente_id: int, servico_id: int) -> bool:
        pass

    @abstractmethod
    async def save(self, projeto: ProjetoEntity) -> ProjetoEntity:
        pass
```

### Caso de Uso (Application Core)
O Caso de Uso depende **apenas do contrato abstrato** (`IProjetoRepository`). Ele não faz ideia se o banco é SQLite, PostgreSQL, Supabase ou se está gravando em arquivos locais!
```python
# src/application/use_cases/criar_projeto.py
from src.application.ports.repositories.i_projeto_repository import IProjetoRepository
from src.domain.entities.projeto import ProjetoEntity
from src.domain.exceptions.business_exceptions import ColisaoContratoException

class CriarProjetoUseCase:
    def __init__(self, projeto_repo: IProjetoRepository):
        self.projeto_repo = projeto_repo

    async def execute(self, usuario_id: int, cliente_id: int, servico_id: int, tipo_recorrencia: str) -> ProjetoEntity:
        # Validação pura do negócio
        colisao = await self.projeto_repo.exists_active_contract(cliente_id, servico_id)
        if colisao:
            raise ColisaoContratoException("Este cliente já tem este serviço contratado de forma ativa.")

        novo_projeto = ProjetoEntity(
            id=None,
            usuario_id=usuario_id,
            cliente_id=cliente_id,
            servico_id=servico_id,
            status="DISCOVERY",
            progresso=0,
            tipo_recorrencia=tipo_recorrencia,
            recorrencia_ativa=True
        )

        return await self.projeto_repo.save(novo_projeto)
```

### Rota da API Gateway (FastAPI Presentation)
Esta rota usa `Depends()` para realizar a injeção do repositório concreto em tempo de execução.
```python
# src/presentation/api/projetos.py
from fastapi import APIRouter, Depends, HTTPException, status
from src.presentation.schemas.projeto_schemas import ProjetoInSchema, ProjetoOutSchema
from src.presentation.middlewares.auth import get_current_user_id
from src.application.use_cases.criar_projeto import CriarProjetoUseCase
from src.infrastructure.adapters.repositories.sqlalchemy_projeto_repo import SQLAlchemyProjetoRepository
from src.domain.exceptions.business_exceptions import ColisaoContratoException

router = APIRouter(prefix="/projetos", tags=["Projetos"])

# Função auxiliar de Injeção de Dependências
def get_criar_projeto_use_case() -> CriarProjetoUseCase:
    repo = SQLAlchemyProjetoRepository() # Instancia o adaptador físico
    return CriarProjetoUseCase(projeto_repo=repo) # Injeta no caso de uso

@router.post("/", response_model=ProjetoOutSchema, status_code=status.HTTP_201_CREATED)
async def criar_projeto(
    payload: ProjetoInSchema,
    usuario_id: int = Depends(get_current_user_id), # Extrai e valida o JWT
    use_case: CriarProjetoUseCase = Depends(get_criar_projeto_use_case) # Resolve Caso de Uso
):
    try:
        projeto_criado = await use_case.execute(
            usuario_id=usuario_id,
            cliente_id=payload.cliente_id,
            servico_id=payload.servico_id,
            tipo_recorrencia=payload.tipo_recorrencia
        )
        return projeto_criado
    except ColisaoContratoException as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
```

---

## 🛠️ 6. Plano de Ação - Cronograma de Recriação do Zero

Este plano de ação começará a ser construído **em uma nova pasta do repositório chamada `backend-fastapi`**, mantendo o backend atual em Django funcionando de forma intacta até a homologação final.

### Fase 1: Setup da Nova Estrutura & Docker
1.  **Criação das Pastas:** Inicializar o diretório `/backend-fastapi` e criar a árvore de pastas limpa.
2.  **Configuração de Pacotes:** Escrever o `requirements.txt` com as dependências do FastAPI e SQLAlchemy.
3.  **Configuração do Docker:** Criar o `docker-compose.yml` local para rodar PostgreSQL e RabbitMQ.

### Fase 2: Codificação do Domínio Puro (Entities)
1.  Escrever as classes de entidade do domínio (`UsuarioEntity`, `ClienteEntity`, `ServicoEntity`, `ProjetoEntity`, `PagamentoEntity`) em `src/domain/entities/`.
2.  Escrever as exceções de negócio em `src/domain/exceptions/`.
3.  Escrever testes unitários em `tests/domain/` para provar as regras financeiras de forma 100% isolada e rápida.

### Fase 3: Escrita dos Contratos (Ports) e Casos de Uso
1.  Criar os contratos abstratos de repositório em `src/application/ports/repositories/`.
2.  Codificar os Casos de Uso estruturados em `src/application/use_cases/` (Login, CRUDs, Faturamento sob demanda).

### Fase 4: Implementação dos Adaptadores Concretos (Infraestrutura)
1.  **Configuração do SQLAlchemy:** Inicializar as tabelas relacionais usando a engine assíncrona do SQLAlchemy em `src/infrastructure/db/`.
2.  **Mapeadores de Repositório:** Codificar os adaptadores em `src/infrastructure/adapters/repositories/` que convertem as Entidades Puras para as consultas SQL físicas.
3.  **Segurança (JWT):** Implementar o serviço de criptografia e validação do token JWT.

### Fase 5: Exposição das Rotas (FastAPI Routers)
1.  Configurar a instância principal do FastAPI em `src/presentation/main.py`.
2.  Escrever os controladores HTTP em `src/presentation/api/` mapeando as rotas da antiga API para os Casos de Uso.
3.  Definir a injeção automática de dependência via `Depends()`.

### Fase 6: Homologação e Troca de Deploy
1.  **Bateria de Testes:** Validar toda a nova API FastAPI localmente usando os testes automatizados e o Swagger.
2.  **Ajuste de Conectividade do React:** Mudar a variável de ambiente `API_URL` do React para apontar para a nova porta da API FastAPI.
3.  **Migração da Nuvem (Deploy Grátis):**
    *   Hospedar a nova API FastAPI gratuitamente no **Render.com** (via Docker ou Python Web Service).
    *   Subir o banco de dados final no **Supabase Free Tier**.
