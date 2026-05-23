# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [2.0.0] - 2025-01-23 (BREAKING)

### 🔐 Security
- ✅ Gerada nova `SECRET_KEY` segura (P0.1)
- ✅ Removidos paths hardcoded de `stitch.py` - usar `Path.home()` e variáveis de ambiente (P0.2)
- ✅ Removido `.env` do versionamento - adicionado ao `.gitignore`
- ✅ Atualizado `.env.example` com documentação completa de segurança

### 🧹 Cleanup
- ✅ Removidos 250MB+ de arquivos Stitch desnecessários:
  - `stitch-skills/` (ferramentas de design não utilizadas)
  - `stitch_workmy_intelligent_freelance_dashboard/` (protótipos antigos)
  - `stitch_info.txt`, `stitch_screen_html.txt` (dumps de API)
- ✅ Consolidada documentação em `/docs/`

### 🛡️ Validation
- ✅ Adicionadas validações de deleção (P0.3):
  - Cliente: não pode deletar se houver projetos associados
  - Serviço: não pode deletar se houver projetos associados
  - Retorna status `409 Conflict` com mensagem clara

### 🐛 Bug Fixes
- ✅ Corrigidos type hints em `events.py` - token como Query parameter obrigatório (P0.4)
- ✅ Adicionada importação `Query` do `ninja` em `events.py`

### 📋 Breaking Changes

⚠️ **API Version**: Endpoints agora em `/api/v1/` (será em próxima fase)
- Todos os clientes devem atualizar suas URLs
- Versão anterior (`/api/`) será descontinuada

⚠️ **Deleção de Clientes/Serviços**: 
- Antes: Deletava em cascata (cliente + projetos + pagamentos)
- Depois: Retorna erro 409 se houver projetos - deve deletar projetos primeiro

⚠️ **Database**: Consolidação de `ProjetoAtivo` em `Projeto` (próxima fase)

### 📝 Migration Guide

Se você estiver atualizando de `v1.x`:

1. **Backend**:
   ```bash
   git pull
   # Atualizar SECRET_KEY em .env (ou painel Render)
   # Atualizar STITCH_MCP_CONFIG_PATH se necessário
   pip install -r requirements.txt
   python manage.py migrate
   ```

2. **Frontend**:
   ```bash
   git pull
   npm install
   # Atualizar VITE_API_BASE_URL quando v1 for ativada
   npm run dev
   ```

3. **Deletar Recursos**:
   - Se tiver clientes com projetos: deletar projetos primeiro
   - Se tiver serviços com projetos: deletar projetos primeiro

### 🗺️ Roadmap (Próximas Fases)

- **FASE 2**: ✅ Limpeza (concluída)
- **FASE 3**: BD Schema - Consolidar ProjetoAtivo, soft delete, auditoria, índices
- **FASE 4**: API RESTful - Versionamento `/v1/`, paginação, filtros
- **FASE 5**: Services - Reorganizar lógica de negócio
- **FASE 6**: Frontend - Atualizar URLs e paginação
- **FASE 7**: Documentação - CHANGELOG, API.md, examples

## [1.1.0] - Melhorias Implementadas (Histórico)

Ver arquivo `docs/IMPROVEMENTS_IMPLEMENTED.md` para histórico anterior.

---

**Nota:** Este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).
