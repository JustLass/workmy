from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario

@admin.register(Usuario)
class UsuarioCustomizadoAdmin(UserAdmin):
    """
    Adiciona os nossos campos personalizados ao painel de administração padrão do Django.
    """
    # Adicionamos uma nova secção 'Informações Extras' ao ecrã de edição de utilizadores
    fieldsets = UserAdmin.fieldsets + (
        ('Informações Extras', {'fields': ('telefone', 'foto_perfil')}),
    )