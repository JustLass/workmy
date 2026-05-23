# Guia de Atualização de APIs e Services - Pós Migração P2.1-P2.4

Este documento fornece as mudanças necessárias para atualizar o código para usar os novos campos consolidados em Projeto.

## 1. Atualizar `backend/api/projetos.py`

### Antes (usando ProjetoAtivo):
```python
# Linhas 94-99
from gestao_freelas.services.recorrencia import obter_ou_criar_ativo
ativo_info = obter_ou_criar_ativo(projeto)
ativo_info.tipo_recorrencia = payload.tipo_recorrencia or 'AVULSO'
ativo_info.ativo = payload.ativo if payload.ativo is not None else True
ativo_info.save()
```

### Depois (usando campos de Projeto):
```python
# Adicione ao criar projeto (linha 84)
projeto = Projeto.objects.create(
    usuario=request.auth,
    cliente=cliente,
    servico=servico,
    status=payload.status or 'DISCOVERY',
    progresso=payload.progresso or 0,
    data_entrega=payload.data_entrega,
    valor=payload.valor,
    tipo_recorrencia=payload.tipo_recorrencia or 'AVULSO',  # ✅ Novo
    recorrencia_ativa=payload.ativo if payload.ativo is not None else True,  # ✅ Novo
)
```

### Atualizar QuerySets (Linhas 74-80, 127-133, 207-213):

**Antes:**
```python
colisao = Projeto.objects.filter(
    usuario=request.auth,
    cliente=cliente,
    servico=servico,
    projeto_ativo__ativo=True,
    projeto_ativo__tipo_recorrencia__in=['MENSAL', 'QUINZENAL']
).exists()
```

**Depois:**
```python
colisao = Projeto.objects.filter(
    usuario=request.auth,
    cliente=cliente,
    servico=servico,
    recorrencia_ativa=True,
    tipo_recorrencia__in=['MENSAL', 'QUINZENAL']
).exists()
```

---

## 2. Atualizar `backend/api/dashboard.py`

### Atualizar querysets (Linhas 171, 181, 335):

**Antes:**
```python
projetos_recorrentes = Projeto.objects.filter(
    usuario=request.auth
).filter(
    Q(projeto_ativo__ativo=True, projeto_ativo__tipo_recorrencia__in=['MENSAL', 'QUINZENAL']) |
    Q(id__in=projetos_com_pagamentos_recorrentes)
).distinct().select_related('projeto_ativo')
```

**Depois:**
```python
projetos_recorrentes = Projeto.objects.filter(
    usuario=request.auth
).filter(
    Q(recorrencia_ativa=True, tipo_recorrencia__in=['MENSAL', 'QUINZENAL']) |
    Q(id__in=projetos_com_pagamentos_recorrentes)
).distinct()
```

### Atualizar acesso a tipo_recorrencia (Linhas 349):

**Antes:**
```python
tipo_rec = p.projeto_ativo.tipo_recorrencia if hasattr(p, 'projeto_ativo') else 'MENSAL'
```

**Depois:**
```python
tipo_rec = p.tipo_recorrencia
```

---

## 3. Atualizar `backend/gestao_freelas/services/recorrencia.py`

### Remover função `obter_ou_criar_ativo`:
```python
# ❌ REMOVER (linhas 16-24)
def obter_ou_criar_ativo(projeto: Projeto) -> ProjetoAtivo:
    ativo_info, created = ProjetoAtivo.objects.get_or_create(...)
    return ativo_info
```

### Atualizar `gerar_parcelas_mensais` (Linhas 84-87):

**Antes:**
```python
ativo_info = obter_ou_criar_ativo(projeto)
if not ativo_info.ativo or ativo_info.tipo_recorrencia == 'AVULSO':
    return {'criados': 0, 'existentes': 0, 'referencias': []}
```

**Depois:**
```python
if not projeto.recorrencia_ativa or projeto.tipo_recorrencia == 'AVULSO':
    return {'criados': 0, 'existentes': 0, 'referencias': []}
```

### Atualizar `gerar_parcelas_mensais` - geração de parcelas (Linhas 113, 130):

**Antes:**
```python
if ativo_info.tipo_recorrencia == 'MENSAL':
    # ...
elif ativo_info.tipo_recorrencia == 'QUINZENAL':
```

**Depois:**
```python
if projeto.tipo_recorrencia == 'MENSAL':
    # ...
elif projeto.tipo_recorrencia == 'QUINZENAL':
```

### Atualizar `ativar_mensalista` (Linhas 190-194):

**Antes:**
```python
ativo_info = obter_ou_criar_ativo(projeto)
ativo_info.ativo = True
ativo_info.tipo_recorrencia = tipo_recorrencia
ativo_info.save()
```

**Depois:**
```python
projeto.recorrencia_ativa = True
projeto.tipo_recorrencia = tipo_recorrencia
projeto.save(update_fields=['recorrencia_ativa', 'tipo_recorrencia'])
```

### Atualizar `desativar_mensalista` (Linhas 205-207):

**Antes:**
```python
ativo_info = obter_ou_criar_ativo(projeto)
ativo_info.ativo = False
ativo_info.save()
```

**Depois:**
```python
projeto.recorrencia_ativa = False
projeto.save(update_fields=['recorrencia_ativa'])
```

### Atualizar `gerar_recorrencias_usuario` (Linha 214):

**Antes:**
```python
projetos = Projeto.objects.filter(usuario_id=usuario_id, projeto_ativo__ativo=True)
```

**Depois:**
```python
projetos = Projeto.objects.filter(usuario_id=usuario_id, recorrencia_ativa=True)
```

---

## 4. Remover Importações Desnecessárias

### Em `backend/api/projetos.py`:
```python
# ❌ REMOVER
from gestao_freelas.services.recorrencia import obter_ou_criar_ativo
```

### Em `backend/gestao_freelas/services/recorrencia.py`:
```python
# ❌ REMOVER
from gestao_freelas.models import Pagamento, Projeto, ProjetoAtivo
# ✅ MANTER APENAS
from gestao_freelas.models import Pagamento, Projeto
```

---

## 5. Verificações Finais

### Checklist de Atualização:
- [ ] `backend/api/projetos.py` atualizado
- [ ] `backend/api/dashboard.py` atualizado
- [ ] `backend/gestao_freelas/services/recorrencia.py` atualizado
- [ ] Função `obter_ou_criar_ativo` removida
- [ ] Importações desnecessárias removidas
- [ ] Testes de API executados
- [ ] Testes de services executados

### Comando para Testar:
```bash
cd backend
uv run python manage.py test api -v 2
uv run python manage.py test gestao_freelas -v 2
```

---

## 6. Atualizar Schemas/Serializers (Se Necessário)

Se houver serializers DRF ou Pydantic schemas, adicionar campos:

```python
class ProjetoOutSchema(Schema):
    id: int
    cliente_id: int
    servico_id: int
    status: str
    progresso: int
    valor: str
    tipo_recorrencia: str  # ✅ Novo
    recorrencia_ativa: bool  # ✅ Novo
    deletado_em: Optional[str]  # ✅ Novo
    criado_em: str
```

---

## 7. Deprecação do ProjetoAtivo

O modelo ProjetoAtivo será mantido por 2 versões para compatibilidade:
- v1: Ambos os campos funcionam (Projeto + ProjetoAtivo)
- v2: Apenas Projeto é usado
- v3: ProjetoAtivo será removido completamente

**Recomendação:** Faça as atualizações agora para se preparar para v3.

---

## Timeline Recomendado

1. **Semana 1:** Implementar todas as mudanças listadas acima
2. **Semana 2:** Testar completamente em staging
3. **Semana 3:** Deploy em produção com monitoramento
4. **Semana 4:** Remover/deprecar referências a ProjetoAtivo

---

## Perguntas Frequentes

**P: Posso deixar o código antigo funcionando?**
R: Sim, mas é recomendado atualizar o mais breve possível para evitar problemas futuros.

**P: Como lidar com dados antigos em ProjetoAtivo?**
R: Os dados foram automaticamente migrados para Projeto na migration 0010. Não há ação necessária.

**P: E se algo quebrar após as mudanças?**
R: Reverter para a commit anterior ou executar:
```bash
python manage.py migrate gestao_freelas 0009
```

---

## Suporte

Para dúvidas, consulte:
- Relatório: `backend/RELATORIO_MIGRACAO_P2.md`
- Models: `backend/gestao_freelas/models.py`
- Testes: `backend/gestao_freelas/tests.py`
