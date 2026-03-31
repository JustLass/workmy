from django.contrib.auth.models import AbstractUser
from django.db import models

class Usuario(AbstractUser):
    """
    Modelo de utilizador customizado do Workmy.
    """
    # Sobrescrevemos o email padrão para o tornar único na base de dados
    email = models.EmailField('endereço de email', unique=True)
    
    telefone = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.username
