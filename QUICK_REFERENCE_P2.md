# Quick Reference - Campos Novos em Projeto

## Modelo Projeto - Campos Consolidados

### Antes (P2.1):
```python
# Dados em ProjetoAtivo (OneToOne)
projeto.projeto_ativo.tipo_recorrencia  # ❌ Indireto
projeto.projeto_ativo.ativo              # ❌ Indireto
```

### Depois (P2.1):
```python
# Dados diretos em Projeto
projeto.tipo_recorrencia        # ✅ Direto: MENSAL, QUINZENAL, AVULSO
projeto.recorrencia_ativa       # ✅ Direto: True/False
```

---

## Soft Delete - Novo Campo em 4 Models

### Todos possuem agora:
```python
cliente.deletado_em              # DateTimeField(null=True, blank=True)
servico.deletado_em              # DateTimeField(null=True, blank=True)
projeto.deletado_em              # DateTimeField(null=True, blank=True)
pagamento.deletado_em            # DateTimeField(null=True, blank=True)
```

### Uso:
```python
# Soft delete
cliente.deletado_em = timezone.now()
cliente.save()

# Verificar se foi deletado
if cliente.deletado_em is None:
    print("Ativo")
else:
    print("Deletado")

# Filtrar apenas ativos (em QuerySets)
queryset = Cliente.objects.filter(deletado_em=None)
```

---

## Novo Modelo: AuditLog

### Campos:
```python
from gestao_freelas.models import AuditLog

audit = AuditLog.objects.create(
    usuario=request.user,
    recurso_tipo='Cliente',          # Tipo do recurso
    recurso_id=123,                  # ID do recurso
    acao='CREATE',                   # CREATE, UPDATE, DELETE
    dados_anterior=None,             # Estado anterior (JSON)
    dados_novo={'nome': 'João'},     # Estado novo (JSON)
    ip_address='192.168.1.1'        # IP do cliente
)
```

---

## Validações Implementadas

### Projeto:
```python
# Automaticamente executadas ao chamar .clean() ou .save()
projeto = Projeto(...)

# ❌ Falha: data_entrega no passado
projeto.data_entrega = timezone.now().date() - timedelta(days=1)
projeto.clean()  # Levanta ValidationError

# ❌ Falha: valor <= 0
projeto.valor = Decimal('0.00')
projeto.clean()  # Levanta ValidationError

# ❌ Falha: progresso fora de 0-100
projeto.progresso = 101
projeto.clean()  # Levanta ValidationError
```

### Pagamento:
```python
# ❌ Falha: valor <= 0 (automaticamente no .save())
pagamento = Pagamento(valor=Decimal('0.00'), ...)
pagamento.save()  # Levanta ValidationError
```

---

## Índices Criados

| Model | Índice | Uso |
|-------|--------|-----|
| Cliente | usuario + criado_em | Listar por usuário e data |
| Serviço | usuario + criado_em | Listar por usuário e data |
| Projeto | usuario + status | Filtrar por status do usuário |
| Projeto | usuario + criado_em | Histórico do usuário |
| Projeto | cliente + status | Projetos por cliente e status |
| Pagamento | projeto + data | Filtrar pagamentos por período |
| Pagamento | referencia_mes | Buscar parcelas mensais |
| AuditLog | recurso_tipo + recurso_id | Histórico de um recurso |
| AuditLog | usuario + criado_em | Auditoria por usuário |

---

## Migrations Aplicadas

```
✅ 0010_consolidate_projeto_ativo     # P2.1
✅ 0011_soft_delete_and_audit         # P2.2
✅ 0012_add_performance_indexes       # P2.3
✅ 0013_integrity_constraints         # P2.4
✅ 0014_alter_projetoativo_options    # DEPRECATED
```

---

## Mudanças Necessárias em APIs

### Remover:
```python
# ❌ Não faça mais isso:
from gestao_freelas.services.recorrencia import obter_ou_criar_ativo
ativo_info = obter_ou_criar_ativo(projeto)
ativo_info.tipo_recorrencia = 'MENSAL'
ativo_info.save()
```

### Usar:
```python
# ✅ Faça assim:
projeto.tipo_recorrencia = 'MENSAL'
projeto.recorrencia_ativa = True
projeto.save()
```

### QuerySets - Antes:
```python
# ❌ Antigo
Projeto.objects.filter(projeto_ativo__ativo=True, 
                       projeto_ativo__tipo_recorrencia='MENSAL')
```

### QuerySets - Depois:
```python
# ✅ Novo
Projeto.objects.filter(recorrencia_ativa=True, 
                       tipo_recorrencia='MENSAL')
```

---

## Testes

```bash
# Executar todos os testes
python manage.py test gestao_freelas.tests -v 2

# Resultado esperado
Ran 15 tests in 6.0s
OK ✅
```

### Cobertura:
- ✅ Validação de Projeto (8 testes)
- ✅ Validação de Pagamento (3 testes)
- ✅ Soft Delete (2 testes)
- ✅ Consolidação (2 testes)

---

## Checklist de Implementação no Seu Código

- [ ] Remover importação de `obter_ou_criar_ativo`
- [ ] Atualizar criação de Projeto com `tipo_recorrencia` e `recorrencia_ativa`
- [ ] Atualizar QuerySets de recorrência
- [ ] Atualizar dashboard para usar novos campos
- [ ] Testar APIs
- [ ] Remover criação/atualização de ProjetoAtivo

---

## Atalho: Converter Código Antigo

**Padrão para encontrar:**
```python
projeto_ativo__ativo|tipo_recorrencia
obter_ou_criar_ativo
```

**Substituir por:**
```python
recorrencia_ativa|tipo_recorrencia
# (remover a função)
```

---

## Compatibilidade

- ✅ Django 6.0.3
- ✅ SQLite, PostgreSQL, MySQL
- ✅ Python 3.10+
- ✅ Backward compatible com ProjetoAtivo (DEPRECATED)

---

**Última Atualização:** 23 de Maio de 2026
