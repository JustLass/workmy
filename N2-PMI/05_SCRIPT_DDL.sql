-- ============================================================================
-- WorkMy — Script DDL (Data Definition Language)
-- Banco de dados: PostgreSQL 15
-- Gerado a partir dos ORM Models (SQLAlchemy 2.0)
-- Arquivo fonte: backend-fastapi/src/infrastructure/persistence/models.py
-- ============================================================================
-- Para executar: psql -U workmy_user -d workmy_db -f 05_SCRIPT_DDL.sql
-- Ou via Docker: docker exec -i workmy_postgres psql -U workmy_user -d workmy_db < 05_SCRIPT_DDL.sql
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Tabela USUARIOS
-- Armazena os freelancers que utilizam o sistema.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL          PRIMARY KEY,
    username        VARCHAR(100)    NOT NULL UNIQUE,
    email           VARCHAR(150)    NOT NULL UNIQUE,
    telefone        VARCHAR(20),
    password_hash   VARCHAR(255)    NOT NULL
);

COMMENT ON TABLE usuarios IS 'Usuários (freelancers) do sistema. Cada registro é um tenant lógico.';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt da senha. Nunca armazena texto plano.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Tabela CLIENTES
-- Clientes cadastrados pelo freelancer. Isolados por usuario_id.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL          PRIMARY KEY,
    usuario_id      INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome            VARCHAR(100)    NOT NULL,
    empresa         VARCHAR(100)    NOT NULL DEFAULT 'Não informada',
    email           VARCHAR(150),
    telefone        VARCHAR(20),
    criado_em       TIMESTAMP       NOT NULL DEFAULT NOW(),
    deletado_em     TIMESTAMP
);

CREATE INDEX idx_clientes_usuario_id ON clientes(usuario_id);
CREATE INDEX idx_clientes_deletado ON clientes(deletado_em) WHERE deletado_em IS NULL;

COMMENT ON TABLE clientes IS 'Clientes do freelancer. Soft delete via deletado_em.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Tabela SERVICOS
-- Serviços oferecidos pelo freelancer. Isolados por usuario_id.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servicos (
    id              SERIAL          PRIMARY KEY,
    usuario_id      INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome            VARCHAR(150)    NOT NULL,
    descricao       VARCHAR(500),
    tags            VARCHAR(250),
    ferramentas     VARCHAR(250),
    github_repo     VARCHAR(200),
    imagem_bytes    BYTEA,
    imagem_mime     VARCHAR(50),
    criado_em       TIMESTAMP       NOT NULL DEFAULT NOW(),
    deletado_em     TIMESTAMP
);

CREATE INDEX idx_servicos_usuario_id ON servicos(usuario_id);
CREATE INDEX idx_servicos_deletado ON servicos(deletado_em) WHERE deletado_em IS NULL;

COMMENT ON TABLE servicos IS 'Serviços do portfólio do freelancer. Pode incluir imagem demonstrativa.';
COMMENT ON COLUMN servicos.tags IS 'Tags separadas por vírgula (CSV). Ex: "React, TypeScript, API".';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Tabela PROJETOS
-- Contratos/projetos que vinculam um cliente a um serviço.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projetos (
    id                  SERIAL          PRIMARY KEY,
    usuario_id          INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cliente_id          INTEGER         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id          INTEGER         NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    status              VARCHAR(20)     NOT NULL DEFAULT 'DISCOVERY',
    progresso           INTEGER         NOT NULL DEFAULT 0,
    data_entrega        DATE,
    valor               NUMERIC(10,2),
    mensalista          BOOLEAN         NOT NULL DEFAULT FALSE,
    valor_mensal        NUMERIC(10,2),
    dia_vencimento      INTEGER         NOT NULL DEFAULT 5,
    recorrencia_inicio  DATE,
    tipo_recorrencia    VARCHAR(20)     NOT NULL DEFAULT 'AVULSO',
    recorrencia_ativa   BOOLEAN         NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMP       NOT NULL DEFAULT NOW(),
    deletado_em         TIMESTAMP
);

CREATE INDEX idx_projetos_usuario_id ON projetos(usuario_id);
CREATE INDEX idx_projetos_cliente_id ON projetos(cliente_id);
CREATE INDEX idx_projetos_servico_id ON projetos(servico_id);
CREATE INDEX idx_projetos_deletado ON projetos(deletado_em) WHERE deletado_em IS NULL;

COMMENT ON TABLE projetos IS 'Contratos. status segue máquina de estados: DISCOVERY→IN_PROGRESS→REVIEW→COMPLETED→ARCHIVED.';
COMMENT ON COLUMN projetos.tipo_recorrencia IS 'MENSAL ou AVULSO. Determina geração automática de pagamentos.';
COMMENT ON COLUMN projetos.dia_vencimento IS 'Dia do mês para gerar cobrança recorrente (1-31).';
COMMENT ON COLUMN projetos.status IS 'Estados: DISCOVERY, IN_PROGRESS, REVIEW, COMPLETED, ARCHIVED.';
COMMENT ON COLUMN projetos.progresso IS 'Percentual de progresso (0 a 100).';

-- NOTA: Unicidade de contrato ativo (cliente_id + servico_id com deletado_em IS NULL)
-- é garantida logicamente pelo CriarProjetoUseCase via exists_active_contract().
-- Uma constraint global impediria recontratação após soft-delete.

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Tabela PAGAMENTOS
-- Registros de pagamentos (mensais ou avulsos) vinculados a projetos.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagamentos (
    id                      SERIAL          PRIMARY KEY,
    projeto_id              INTEGER         NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    valor                   NUMERIC(10,2)   NOT NULL,
    tipo_pagamento          VARCHAR(10)     NOT NULL DEFAULT 'MENSAL',
    data                    DATE            NOT NULL,
    observacao              VARCHAR(500),
    referencia_mes          VARCHAR(7),
    gerado_automaticamente  BOOLEAN         NOT NULL DEFAULT FALSE,
    comprovante_bytes       BYTEA,
    comprovante_mime        VARCHAR(50),
    criado_em               TIMESTAMP       NOT NULL DEFAULT NOW(),
    deletado_em             TIMESTAMP,

    -- ⚡ CONSTRAINT DE IDEMPOTÊNCIA ⚡
    -- Impede que o mesmo projeto tenha dois pagamentos para a mesma referência mensal.
    -- Isso garante que a geração de recorrências seja idempotente.
    CONSTRAINT uniq_pagamento_projeto_referencia_mes
        UNIQUE (projeto_id, referencia_mes)
);

CREATE INDEX idx_pagamentos_projeto_id ON pagamentos(projeto_id);
CREATE INDEX idx_pagamentos_referencia ON pagamentos(referencia_mes);
CREATE INDEX idx_pagamentos_deletado ON pagamentos(deletado_em) WHERE deletado_em IS NULL;

COMMENT ON TABLE pagamentos IS 'Pagamentos: MENSAL (gerado por recorrência) ou AVULSO (manual).';
COMMENT ON COLUMN pagamentos.referencia_mes IS 'Formato YYYY-MM. UniqueConstraint com projeto_id garante idempotência.';
COMMENT ON COLUMN pagamentos.gerado_automaticamente IS 'true = gerado pelo FaturarRecorrenciasUseCase; false = lançamento manual.';
COMMENT ON COLUMN pagamentos.tipo_pagamento IS 'MENSAL ou AVULSO.';

-- ============================================================================
-- FIM DO SCRIPT DDL
-- ============================================================================
-- Total de tabelas: 5
-- Relacionamentos: 6 Foreign Keys
-- Constraints especiais: 1 UniqueConstraint (idempotência)
-- Soft Delete: em todas as tabelas de negócio (clientes, servicos, projetos, pagamentos)
-- ============================================================================
