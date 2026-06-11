# 📚 WorkMy — Entrega N2 (Projeto Multidisciplinar Integrador)

> **Aluno:** Rafael Lass  
> **Curso:** Análise e Desenvolvimento de Sistemas  
> **Data de entrega:** Junho/2026

---

## 📋 Checklist de Artefatos Entregues

| # | Artefato | Arquivo | Status |
|---|----------|---------|--------|
| 1 | Diagrama de Sequência (Login) | [01_DIAGRAMA_SEQUENCIA_LOGIN.md](./01_DIAGRAMA_SEQUENCIA_LOGIN.md) | ✅ |
| 2 | Diagrama de Sequência (CRUD) | [02_DIAGRAMA_SEQUENCIA_CRUD.md](./02_DIAGRAMA_SEQUENCIA_CRUD.md) | ✅ |
| 3 | Diagrama de Casos de Uso Refinado | [03_DIAGRAMA_CASOS_DE_USO.md](./03_DIAGRAMA_CASOS_DE_USO.md) | ✅ |
| 4 | DER + ORM (SQL) | [04_DER_ORM_SQL.md](./04_DER_ORM_SQL.md) | ✅ |
| 5 | Script SQL (DDL executável) | [05_SCRIPT_DDL.sql](./05_SCRIPT_DDL.sql) | ✅ |
| 6 | Código: Front / Back / Integração BD | [06_CODIGO_SISTEMA.md](./06_CODIGO_SISTEMA.md) | ✅ |

---

## 🛠️ Tecnologias do Projeto

| Camada | Tecnologia |
|--------|-----------|
| Frontend (SPA) | React 19 + Vite + TypeScript |
| BFF (Gateway) | Node.js + Express |
| Backend (API) | Python 3.12 + FastAPI (assíncrono) |
| Banco de Dados | PostgreSQL 15 |
| Mensageria | RabbitMQ 3 |
| Orquestração | Docker Compose |

---

## 🚀 Como Rodar o Sistema

```bash
# 1. Subir banco + mensageria + Backend + BFF
docker compose up -d

# 4. Frontend React
cd frontend && npm install && npm run dev
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| BFF Proxy | http://localhost:3000 |
| FastAPI (Swagger) | http://localhost:8000/docs |
| RabbitMQ Management | http://localhost:15672 |

---

## 📖 Como Visualizar os Diagramas

Todos os diagramas estão em **Mermaid.js** e podem ser visualizados:

1. **GitHub** — renderiza nativamente ao abrir os `.md`
2. **VS Code** — com a extensão "Mermaid Preview"
3. **Online** — cole os blocos ```mermaid em [mermaid.live](https://mermaid.live)

---

*Cada artefato possui explicação detalhada em linguagem acadêmica, conectando os diagramas ao código-fonte real do projeto.*
