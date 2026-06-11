# 🗄️ DER + ORM (SQL)

> Este documento apresenta o **Diagrama Entidade-Relacionamento (DER)** e o **mapeamento ORM** do sistema WorkMy, com explicação de cada tabela, seus relacionamentos e as decisões de modelagem.

---

## 1. Diagrama Entidade-Relacionamento (DER)

```mermaid
erDiagram
    USUARIOS ||--o{ CLIENTES : "possui (1:N)"
    USUARIOS ||--o{ SERVICOS : "possui (1:N)"
    USUARIOS ||--o{ PROJETOS : "possui (1:N)"
    CLIENTES ||--o{ PROJETOS : "contratante (1:N)"
    SERVICOS ||--o{ PROJETOS : "serviço contratado (1:N)"
    PROJETOS ||--o{ PAGAMENTOS : "gera pagamentos (1:N)"

    USUARIOS {
        int id PK "AUTO_INCREMENT"
        varchar_100 username UK "NOT NULL, UNIQUE"
        varchar_150 email UK "NOT NULL, UNIQUE"
        varchar_20 telefone "NULLABLE"
        varchar_255 password_hash "NOT NULL (bcrypt)"
    }

    CLIENTES {
        int id PK "AUTO_INCREMENT"
        int usuario_id FK "NOT NULL → usuarios.id ON DELETE CASCADE"
        varchar_100 nome "NOT NULL"
        varchar_100 empresa "DEFAULT 'Nao informada'"
        varchar_150 email "NULLABLE"
        varchar_20 telefone "NULLABLE"
        datetime criado_em "DEFAULT NOW()"
        datetime deletado_em "NULLABLE (soft delete)"
    }

    SERVICOS {
        int id PK "AUTO_INCREMENT"
        int usuario_id FK "NOT NULL → usuarios.id ON DELETE CASCADE"
        varchar_150 nome "NOT NULL"
        varchar_500 descricao "NULLABLE"
        varchar_250 tags "NULLABLE (CSV)"
        varchar_250 ferramentas "NULLABLE (CSV)"
        varchar_200 github_repo "NULLABLE (URL)"
        bytea imagem_bytes "NULLABLE (binary)"
        varchar_50 imagem_mime "NULLABLE (ex: image/png)"
        datetime criado_em "DEFAULT NOW()"
        datetime deletado_em "NULLABLE (soft delete)"
    }

    PROJETOS {
        int id PK "AUTO_INCREMENT"
        int usuario_id FK "NOT NULL → usuarios.id ON DELETE CASCADE"
        int cliente_id FK "NOT NULL → clientes.id ON DELETE CASCADE"
        int servico_id FK "NOT NULL → servicos.id ON DELETE CASCADE"
        varchar_20 status "DEFAULT 'DISCOVERY'"
        int progresso "DEFAULT 0 (0-100)"
        date data_entrega "NULLABLE"
        numeric_10_2 valor "NULLABLE"
        boolean mensalista "DEFAULT false"
        numeric_10_2 valor_mensal "NULLABLE"
        int dia_vencimento "DEFAULT 5"
        date recorrencia_inicio "NULLABLE"
        varchar_20 tipo_recorrencia "DEFAULT 'AVULSO'"
        boolean recorrencia_ativa "DEFAULT true"
        datetime criado_em "DEFAULT NOW()"
        datetime deletado_em "NULLABLE (soft delete)"
    }

    PAGAMENTOS {
        int id PK "AUTO_INCREMENT"
        int projeto_id FK "NOT NULL → projetos.id ON DELETE CASCADE"
        numeric_10_2 valor "NOT NULL"
        varchar_10 tipo_pagamento "DEFAULT 'MENSAL'"
        date data "NOT NULL"
        varchar_500 observacao "NULLABLE"
        varchar_7 referencia_mes "NULLABLE (ex: 2026-06)"
        boolean gerado_automaticamente "DEFAULT false"
        bytea comprovante_bytes "NULLABLE (binary)"
        varchar_50 comprovante_mime "NULLABLE"
        datetime criado_em "DEFAULT NOW()"
        datetime deletado_em "NULLABLE (soft delete)"
    }
```

---

## 2. Explicação dos Relacionamentos

| Relacionamento | Cardinalidade | Descrição |
|---|---|---|
| USUARIOS → CLIENTES | 1:N | Um usuário (freelancer) cadastra vários clientes. Isolamento multitenant. |
| USUARIOS → SERVICOS | 1:N | Um usuário define vários serviços que oferece. |
| USUARIOS → PROJETOS | 1:N | Um usuário possui vários projetos (para auditoria e filtro direto). |
| CLIENTES → PROJETOS | 1:N | Um cliente pode ter vários projetos/contratos contratados. |
| SERVICOS → PROJETOS | 1:N | Um serviço pode estar em vários projetos (com clientes diferentes). |
| PROJETOS → PAGAMENTOS | 1:N | Um projeto gera vários pagamentos (mensais ou avulsos). |

---

## 3. Constraints e Regras de Integridade

| Regra | Implementação | Localização |
|---|---|---|
| **Unicidade de e-mail/username** | `UNIQUE` nas colunas `email` e `username` de `usuarios` | `models.py` L11-12 |
| **Isolamento multitenant** | Todo `SELECT/INSERT/UPDATE` filtra por `usuario_id` | Repositories |
| **Soft Delete universal** | Coluna `deletado_em` (NULLABLE) em todas as entidades de negócio | `models.py` |
| **Idempotência de faturamento** | `UniqueConstraint("projeto_id", "referencia_mes")` em `pagamentos` | `models.py` L106-108 |
| **Cascade on delete** | `ForeignKey(..., ondelete="CASCADE")` em todas as FKs | `models.py` |
| **Colisão de contrato (lógica)** | `exists_active_contract()` verifica unicidade de (cliente, serviço) onde `deletado_em IS NULL` | `criar_projeto.py` |

---

## 4. Máquina de Estados do Projeto

O campo `status` de `PROJETOS` segue transições definidas no domínio:

```mermaid
stateDiagram-v2
    [*] --> DISCOVERY : Projeto criado
    DISCOVERY --> IN_PROGRESS : Início dos trabalhos
    DISCOVERY --> ARCHIVED : Cancelado antes de iniciar
    IN_PROGRESS --> REVIEW : Entrega para revisão
    IN_PROGRESS --> ARCHIVED : Cancelado durante execução
    REVIEW --> IN_PROGRESS : Revisão requer ajustes
    REVIEW --> COMPLETED : Aprovado pelo cliente
    REVIEW --> ARCHIVED : Cancelado na revisão
    COMPLETED --> ARCHIVED : Arquivado após conclusão
    ARCHIVED --> [*] : Estado terminal
```

---

## 5. Mapeamento ORM — SQLAlchemy

A tabela abaixo mostra como cada tabela do banco é mapeada para classes ORM no SQLAlchemy 2.0:

| Tabela SQL | Classe ORM | Arquivo |
|---|---|---|
| `usuarios` | `UsuarioModel` | `models.py` L7-18 |
| `clientes` | `ClienteModel` | `models.py` L21-34 |
| `servicos` | `ServicoModel` | `models.py` L37-53 |
| `projetos` | `ProjetoModel` | `models.py` L56-85 |
| `pagamentos` | `PagamentoModel` | `models.py` L88-108 |

### Exemplo: UsuarioModel (ORM)

```python
class UsuarioModel(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relacionamentos ORM
    clientes: Mapped[list["ClienteModel"]] = relationship("ClienteModel", back_populates="usuario")
    servicos: Mapped[list["ServicoModel"]] = relationship("ServicoModel", back_populates="usuario")
    projetos: Mapped[list["ProjetoModel"]] = relationship("ProjetoModel", back_populates="usuario")
```

### Exemplo: PagamentoModel (ORM com UniqueConstraint)

```python
class PagamentoModel(Base):
    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos.id", ondelete="CASCADE"), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tipo_pagamento: Mapped[str] = mapped_column(String(10), default="MENSAL", nullable=False)
    referencia_mes: Mapped[str | None] = mapped_column(String(7), nullable=True)
    gerado_automaticamente: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # ...

    __table_args__ = (
        UniqueConstraint("projeto_id", "referencia_mes", name="uniq_pagamento_projeto_referencia_mes"),
    )
```

---

## 6. Domain Entities vs ORM Models

O projeto separa **Domain Entities** (regras de negócio puras) dos **ORM Models** (persistência):

| Conceito | Responsabilidade | Localização |
|---|---|---|
| **Domain Entity** | Validação, regras de negócio, transições de estado | `domain/entities/*.py` |
| **ORM Model** | Mapeamento para tabela SQL, relacionamentos físicos | `infrastructure/persistence/models.py` |
| **Repository** | Converte entre Entity ↔ Model | `infrastructure/persistence/repositories/*.py` |

O Use Case **nunca** importa o ORM Model diretamente. Ele trabalha apenas com Entities e Ports (interfaces).

---

## 7. Decisões de Modelagem

| Decisão | Justificativa |
|---|---|
| **Soft Delete em tudo** | Preserva histórico. Permite recontratação de clientes/serviços excluídos. |
| **`usuario_id` em projetos (redundante)** | Permite filtros O(1) sem JOINs para listagem de projetos. Trade-off: desnormalização controlada. |
| **`tags` e `ferramentas` como CSV** | Simplicidade. Para filtros avançados, migraria para tabela N:N ou `ARRAY[]` do PostgreSQL. |
| **Imagem/comprovante como `bytea`** | Armazena o binário no banco. Para escala, migraria para Object Storage (S3). |
| **`referencia_mes` como String "YYYY-MM"** | Facilita a constraint de unicidade e consultas por período. |
