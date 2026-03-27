# Workmy 🚀

Sistema para gerenciamento de freelancers, focado em regras de negócio, integridade de dados e estabilidade.

## 🏗️ Arquitetura e Tecnologias
*   **Backend:** Python com Django
*   **Banco de Dados:** PostgreSQL (hospedado na nuvem via Supabase)
*   **Gerenciador de Pacotes e Ambiente:** `uv` (gerenciador super rápido escrito em Rust)
*   **Deploy/Infra:** Render (com deploy automatizado via GitHub)

## ⚙️ Pré-requisitos
Antes de começar, você precisa ter instalado na sua máquina:
1.  Git
2.  Python (versão 3.12 ou superior)
3.  [uv](https://docs.astral.sh/uv/getting-started/installation/) instalado globalmente.

---

## 🚀 Passo a Passo para Desenvolvimento Local

**1. Clone o repositório**
```bash
git clone [https://github.com/SEU_USUARIO/workmy.git](https://github.com/SEU_USUARIO/workmy.git)
cd workmy
```

**2. Crie o ambiente virtual com o uv**
Na raiz do projeto, rode o comando abaixo para criar a pasta `.venv`:
```bash
uv venv
```
*(Dica: Se estiver usando o VS Code, ele geralmente já reconhece o ambiente virtual automaticamente. Se precisar ativar manualmente no Windows, use `.venv\Scripts\activate`)*

**3. Instale as dependências**
Com o ambiente criado, instale as bibliotecas listadas no projeto:
```bash
uv pip install -r requirements.txt
```

**4. Configure as Variáveis de Ambiente (.env)**
Na raiz do projeto (no mesmo nível do arquivo `manage.py`), crie um arquivo chamado **exatamente** `.env`.
Solicite as credenciais do banco de dados para a equipe e preencha com o seguinte formato:
```env
DEBUG=True
SECRET_KEY=uma-chave-secreta-qualquer-para-desenvolvimento
DATABASE_URL=postgresql://usuario:senha@host-do-supabase:5432/postgres
```
*⚠️ Importante: O arquivo `.env` já está no `.gitignore`. Nunca suba suas senhas ou a URL do banco real para o repositório.*

**5. Rode as migrações**
Para garantir que o banco de dados está sincronizado com os modelos mais recentes do Django, execute:
```bash
uv run python manage.py migrate
```

**6. Suba o servidor local**
```bash
uv run python manage.py runserver
```
Pronto! Acesse `http://127.0.0.1:8000/` no seu navegador para ver o projeto rodando.

---

## 📂 Estrutura de Pastas Principal
*   `/core/` -> Configurações centrais do Django (`settings.py`, roteamento base).
*   `/docs/` -> Diagramas, fluxos de tela e documentação de regras de negócio.
*   `build.sh` -> Script utilizado internamente pelo Render para realizar o deploy em produção.
*   `pyproject.toml` / `requirements.txt` -> Controle de dependências do projeto.