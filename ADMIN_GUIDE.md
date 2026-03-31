# 🔧 Guia de Configuração do Django Admin

## 📋 Índice

1. [Introdução](#-introdução)
2. [Criação de Superusuário](#-criação-de-superusuário)
3. [Estrutura dos Admins](#-estrutura-dos-admins)
4. [Recursos Implementados](#-recursos-implementados)
5. [Uso do Admin](#-uso-do-admin)
6. [Customizações](#-customizações)

---

## 🎯 Introdução

O Django Admin do WorkMy foi configurado para gerenciar todos os modelos da aplicação com recursos avançados:

- ✅ Interface intuitiva e responsiva
- ✅ Filtros dinâmicos
- ✅ Busca em múltiplos campos
- ✅ Isolamento de dados por usuário
- ✅ Inlines para relacionamentos
- ✅ Date hierarchy para navegação temporal

---

## 👤 Criação de Superusuário

### Primeiro Acesso

Execute o comando para criar um administrador:

```bash
python manage.py createsuperuser
```

**Será solicitado:**

```
Username: admin
Email: admin@workmy.com
Password: ********
Password (again): ********
```

### Acesso ao Admin

Após criar o superusuário, acesse:

```
URL: http://localhost:8000/admin/
```

---

## 🗂️ Estrutura dos Admins

### 1. Usuario Admin (`usuarios/admin.py`)

**Classe:** `UsuarioAdmin`

**Campos exibidos na lista:**
- Username
- Email
- Nome completo (first_name, last_name)
- Telefone
- Status de staff
- Data de cadastro

**Filtros disponíveis:**
- É staff?
- É superusuário?
- Está ativo?
- Data de cadastro

**Busca:**
- Username
- Email
- Nome
- Sobrenome
- Telefone

**Fieldsets personalizados:**
```python
# Informações básicas (username, password, etc)
# + Informações Adicionais:
#   - Telefone
#   - Foto de perfil
```

---

### 2. Cliente Admin (`gestao_freelas/admin.py`)

**Classe:** `ClienteAdmin`

**Campos exibidos:**
- Nome
- Email
- Telefone
- Usuário (dono)
- Data de criação

**Filtros:**
- Data de criação
- Usuário

**Busca:**
- Nome
- Email
- Telefone

**Isolamento:**
```python
def get_queryset(self, request):
    # Superusuários veem todos
    if request.user.is_superuser:
        return qs
    # Usuários comuns veem apenas seus clientes
    return qs.filter(usuario=request.user)
```

**Date Hierarchy:** Navegação por mês/ano de criação

---

### 3. Servico Admin (`gestao_freelas/admin.py`)

**Classe:** `ServicoAdmin`

**Campos exibidos:**
- Nome
- Usuário (dono)
- Data de criação

**Filtros:**
- Data de criação
- Usuário

**Busca:**
- Nome
- Descrição

**Isolamento:** Apenas serviços do usuário logado

---

### 4. Projeto Admin (`gestao_freelas/admin.py`)

**Classe:** `ProjetoAdmin`

**Campos exibidos:**
- String representativa (Cliente - Serviço)
- Cliente
- Serviço
- Usuário
- Data de criação

**Filtros:**
- Data de criação
- Usuário
- Serviço

**Busca:**
- Nome do cliente
- Nome do serviço

**Inline:** Pagamentos relacionados (edição rápida)

**Isolamento:** Apenas projetos do usuário logado

---

### 5. Pagamento Admin (`gestao_freelas/admin.py`)

**Classe:** `PagamentoAdmin`

**Campos exibidos:**
- String representativa (Tipo: R$ Valor - Cliente)
- Projeto
- Valor
- Tipo de pagamento
- Data

**Filtros:**
- Tipo de pagamento (MENSAL/AVULSO)
- Data
- Usuário do projeto

**Busca:**
- Nome do cliente (via projeto)
- Nome do serviço (via projeto)
- Observação

**Date Hierarchy:** Navegação por data de pagamento

**Isolamento:**
```python
return qs.filter(projeto__usuario=request.user)
```

---

## ✨ Recursos Implementados

### 1. Filtros Laterais

Todos os admins possuem filtros inteligentes:

```python
list_filter = ['criado_em', 'usuario', 'tipo_pagamento']
```

**Exemplo prático:**
- Filtrar clientes criados este mês
- Ver apenas pagamentos mensais
- Listar projetos de um usuário específico

### 2. Busca Avançada

```python
search_fields = ['nome', 'email', 'telefone']
```

**Como usar:**
- Digite no campo de busca no topo
- Busca em múltiplos campos simultaneamente
- Case-insensitive (ignora maiúsculas/minúsculas)

### 3. Date Hierarchy

Navegação temporal em modelos com datas:

```python
date_hierarchy = 'criado_em'
```

**Funcionalidade:**
- Clique no ano → Vê todos os meses
- Clique no mês → Vê todos os dias
- Clique no dia → Vê registros específicos

### 4. Inlines (Edição Relacionada)

O `ProjetoAdmin` possui `PagamentoInline`:

```python
class PagamentoInline(admin.TabularInline):
    model = Pagamento
    extra = 0
```

**Vantagem:**
- Criar/editar pagamentos diretamente na página do projeto
- Visualização compacta em tabela
- Sem necessidade de múltiplas páginas

### 5. Fieldsets Organizados

Campos agrupados logicamente:

```python
fieldsets = (
    ('Informações do Cliente', {
        'fields': ('nome', 'email', 'telefone')
    }),
    ('Relacionamento', {
        'fields': ('usuario',)
    }),
)
```

**Resultado:** Interface mais limpa e organizada

### 6. Ordenação Personalizada

```python
ordering = ['-criado_em']
```

**Comportamento:** Registros mais recentes aparecem primeiro

---

## 🖱️ Uso do Admin

### Workflow Típico

#### 1. Criar um Cliente

```
1. Acesse /admin/
2. Clique em "Clientes" → "Adicionar Cliente"
3. Preencha: nome, email, telefone
4. Selecione o usuário (você mesmo)
5. Clique em "Salvar"
```

#### 2. Criar um Serviço

```
1. "Serviços" → "Adicionar Serviço"
2. Preencha: nome, descrição
3. Selecione o usuário
4. "Salvar"
```

#### 3. Criar um Projeto

```
1. "Projetos" → "Adicionar Projeto"
2. Selecione: cliente, serviço, usuário
3. [OPCIONAL] Adicione pagamentos inline
4. "Salvar"
```

#### 4. Adicionar Pagamentos

**Opção 1: Inline (recomendado)**
- Edite um projeto existente
- Role até "Pagamentos"
- Clique em "Adicionar outro Pagamento"
- Preencha: valor, tipo, data, observação

**Opção 2: Standalone**
- "Pagamentos" → "Adicionar Pagamento"
- Selecione o projeto
- Preencha os dados

---

## 🎨 Customizações

### Modificar Campos Exibidos

Edite `list_display` em `admin.py`:

```python
@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ['nome', 'email', 'telefone', 'criado_em']
    #                  ↑ adicione ou remova campos
```

### Adicionar Novos Filtros

```python
list_filter = ['criado_em', 'usuario', 'novo_campo']
```

### Personalizar Busca

```python
search_fields = ['nome', 'email', 'cpf']  # exemplo
```

### Alterar Ordenação

```python
ordering = ['-criado_em']   # mais recentes primeiro
# ou
ordering = ['nome']          # ordem alfabética
```

### Adicionar Actions Customizadas

```python
@admin.action(description='Marcar como pago')
def marcar_pago(self, request, queryset):
    queryset.update(status='PAGO')

class PagamentoAdmin(admin.ModelAdmin):
    actions = [marcar_pago]
```

---

## 🔒 Segurança no Admin

### Isolamento de Dados

Todos os admins implementam `get_queryset()`:

```python
def get_queryset(self, request):
    qs = super().get_queryset(request)
    if request.user.is_superuser:
        return qs  # vê tudo
    return qs.filter(usuario=request.user)  # vê apenas seus dados
```

**Resultado:**
- Superusuários veem todos os registros
- Usuários staff veem apenas o que criaram
- Usuários comuns não acessam o admin

### Permissions

Para dar acesso ao admin sem superusuário:

```python
# No shell ou em um comando
from django.contrib.auth.models import Permission
user = Usuario.objects.get(username='joao')
user.is_staff = True
user.save()

# Adicionar permissões específicas
perm = Permission.objects.get(codename='add_cliente')
user.user_permissions.add(perm)
```

---

## 📊 Dashboard do Admin

### Estatísticas Rápidas (Padrão)

O admin exibe automaticamente:
- Total de registros de cada modelo
- Ações recentes do usuário
- Logs de alterações

### Personalizar Dashboard (Opcional)

Crie um `AdminSite` customizado:

```python
# core/admin.py
from django.contrib.admin import AdminSite

class WorkMyAdminSite(AdminSite):
    site_header = 'WorkMy Administração'
    site_title = 'WorkMy Admin'
    index_title = 'Painel de Controle'

admin_site = WorkMyAdminSite(name='workmy_admin')
```

---

## 🛠️ Troubleshooting

### Problema: "Superusuário não consegue logar"

**Solução:**
```bash
python manage.py changepassword admin
```

### Problema: "Campos não aparecem no formulário"

**Solução:** Verifique `fieldsets` ou `fields`:
```python
fieldsets = (
    (None, {'fields': ('nome', 'email')}),
)
```

### Problema: "Não vejo meus dados no admin"

**Solução:** Verifique `get_queryset()`:
```python
def get_queryset(self, request):
    return super().get_queryset(request)  # remove filtros
```

---

## 📚 Recursos Adicionais

### Documentação Oficial

- [Django Admin Docs](https://docs.djangoproject.com/en/stable/ref/contrib/admin/)
- [ModelAdmin Options](https://docs.djangoproject.com/en/stable/ref/contrib/admin/#modeladmin-options)

### Dicas Avançadas

1. **Admin Responsivo:** Use `list_per_page = 50` para paginação
2. **Exportar CSV:** Adicione action para export
3. **Filtros Customizados:** Crie `SimpleListFilter`
4. **Autocomplete:** Use `autocomplete_fields` para ForeignKeys

---

## ✅ Checklist de Configuração

- [x] Superusuário criado
- [x] Todos os modelos registrados
- [x] `list_display` configurado
- [x] `list_filter` adicionado
- [x] `search_fields` definido
- [x] `ordering` configurado
- [x] Isolamento por usuário implementado
- [x] Inlines configurados
- [x] Date hierarchy ativado
- [x] Fieldsets organizados

---

**Admin configurado com sucesso! 🎉**

Acesse: http://localhost:8000/admin/
