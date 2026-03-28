from django.db import models

# Create your models here.

class Cliente(models.Model):
    '''Tabela de clientes'''
    nome = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, blank=True,null=True, unique=True) # Valida se o texto é valido
    telefone = models.CharField(max_length=15, blank=True, null=True, unique=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    def __str__(self):
            return self.nome
        
class Servico(models.Model):
    '''Tabela de serviços'''
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True, null=True, max_length=500)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.nome
    
class Projeto(models.Model):
    '''Tabela associativa para clientes, serviços'''
    # Opções predefinidas para a periodicidade da cobrança
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='projetos')
    servico = models.ForeignKey(Servico, on_delete=models.CASCADE, related_name='projetos')

    criado_em = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.cliente.nome} - {self.servico.nome}"

class Pagamento(models.Model):
    # Opções simplificadas e diretas
    TIPO_PAGAMENTO_CHOICES = [
        ('MENSAL', 'Mensalidade'),
        ('AVULSO', 'Pagamento Avulso / Extra'),
    ]

    projeto = models.ForeignKey(Projeto, on_delete=models.CASCADE, related_name='pagamentos')
    
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    
    tipo_pagamento = models.CharField(
        max_length=10, 
        choices=TIPO_PAGAMENTO_CHOICES, 
        default='MENSAL'
    )
    
    data = models.DateField(help_text="Data do pagamento ou vencimento")
    observacao = models.TextField(blank=True, null=True, max_length=500)

    def __str__(self):
        return f"{self.get_tipo_pagamento_display()}: R$ {self.valor} - {self.projeto.cliente.nome}"