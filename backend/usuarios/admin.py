from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    """
    Interface administrativa customizada para o modelo Usuario.
    """
    list_display = ['username', 'email', 'first_name', 'last_name', 'telefone', 'is_staff', 'date_joined']
    list_filter = ['is_staff', 'is_superuser', 'is_active', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'telefone']
    ordering = ['-date_joined']
    
    # Adiciona os campos customizados nos fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Informações Adicionais', {
            'fields': ('telefone',)
        }),
    )
    
    # Adiciona os campos customizados ao formulário de criação
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informações Adicionais', {
            'fields': ('email', 'telefone')
        }),
    )
