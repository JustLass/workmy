from django.contrib import admin
from .models import Cliente, Servico, Projeto, Pagamento

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    """
    Interface administrativa para gerenciar Clientes.
    """
    list_display = ['nome', 'email', 'telefone', 'usuario', 'criado_em']
    list_filter = ['criado_em', 'usuario']
    search_fields = ['nome', 'email', 'telefone']
    ordering = ['-criado_em']
    date_hierarchy = 'criado_em'
    
    fieldsets = (
        ('Informações do Cliente', {
            'fields': ('nome', 'email', 'telefone')
        }),
        ('Relacionamento', {
            'fields': ('usuario',)
        }),
    )
    
    def get_queryset(self, request):
        """
        Permite superusuários verem todos os clientes,
        usuários comuns veem apenas seus próprios clientes.
        """
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(usuario=request.user)


@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    """
    Interface administrativa para gerenciar Serviços.
    """
    list_display = ['nome', 'usuario', 'criado_em']
    list_filter = ['criado_em', 'usuario']
    search_fields = ['nome', 'descricao']
    ordering = ['-criado_em']
    date_hierarchy = 'criado_em'
    
    fieldsets = (
        ('Informações do Serviço', {
            'fields': ('nome', 'descricao')
        }),
        ('Relacionamento', {
            'fields': ('usuario',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(usuario=request.user)


@admin.register(Projeto)
class ProjetoAdmin(admin.ModelAdmin):
    """
    Interface administrativa para gerenciar Projetos.
    """
    list_display = ['__str__', 'cliente', 'servico', 'usuario', 'criado_em']
    list_filter = ['criado_em', 'usuario', 'servico']
    search_fields = ['cliente__nome', 'servico__nome']
    ordering = ['-criado_em']
    date_hierarchy = 'criado_em'
    
    fieldsets = (
        ('Relacionamentos', {
            'fields': ('usuario', 'cliente', 'servico')
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(usuario=request.user)


class PagamentoInline(admin.TabularInline):
    """
    Inline para exibir pagamentos dentro do Projeto.
    """
    model = Pagamento
    extra = 0
    fields = ['valor', 'tipo_pagamento', 'data', 'observacao']


@admin.register(Pagamento)
class PagamentoAdmin(admin.ModelAdmin):
    """
    Interface administrativa para gerenciar Pagamentos.
    """
    list_display = ['__str__', 'projeto', 'valor', 'tipo_pagamento', 'data']
    list_filter = ['tipo_pagamento', 'data', 'projeto__usuario']
    search_fields = ['projeto__cliente__nome', 'projeto__servico__nome', 'observacao']
    ordering = ['-data']
    date_hierarchy = 'data'
    
    fieldsets = (
        ('Informações do Pagamento', {
            'fields': ('projeto', 'valor', 'tipo_pagamento', 'data', 'observacao')
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(projeto__usuario=request.user)


# Adiciona o inline de pagamentos ao ProjetoAdmin
ProjetoAdmin.inlines = [PagamentoInline]
