from django.contrib.auth.forms import UserCreationForm
from .models import Usuario

class UsuarioRegistroForm(UserCreationForm):
    """
    Formulário de registro adaptado para o nosso Usuário Customizado.
    """
    class Meta:
        model = Usuario
        # Listamos explicitamente todos os campos que o usuário deve preencher
        fields = ['username', 'email', 'telefone', 'foto_perfil']