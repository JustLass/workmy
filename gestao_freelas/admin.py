from django.contrib import admin
from .models import Cliente, Servico, Projeto, Pagamento

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    """
    Configuração do painel de administração para a entidade Cliente.
    Exibe as colunas de contato na listagem e adiciona uma barra de pesquisa.
    """
    list_display = ('nome', 'email', 'telefone', 'criado_em')
    search_fields = ('nome', 'email')

@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    """
    Configuração do painel de administração para a entidade Serviço.
    """
    list_display = ('nome', 'criado_em')
    search_fields = ('nome',)

@admin.register(Projeto)
class ProjetoAdmin(admin.ModelAdmin):
    """
    Configuração do painel de administração para Projetos (Contratos).
    Permite filtrar rapidamente os projetos por cliente ou tipo de serviço.
    """
    list_display = ('cliente', 'servico', 'criado_em')
    list_filter = ('servico', 'cliente')
    search_fields = ('cliente__nome', 'servico__nome')

@admin.register(Pagamento)
class PagamentoAdmin(admin.ModelAdmin):
    """
    Configuração do painel de administração para Pagamentos.
    Traz filtros essenciais de data e tipo para facilitar o controle financeiro.
    """
    list_display = ('projeto', 'valor', 'tipo_pagamento', 'data')
    list_filter = ('tipo_pagamento', 'data')
    # Permite pesquisar um pagamento digitando o nome do cliente vinculado ao projeto!
    search_fields = ('projeto__cliente__nome',)