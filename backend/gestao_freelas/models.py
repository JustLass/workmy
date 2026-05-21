from django.db import models
from django.conf import settings
# Create your models here.

class Cliente(models.Model):
    '''Tabela de clientes'''
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='clientes')
    
    nome = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    def __str__(self):
            return self.nome
        
class Servico(models.Model):
    '''Tabela de serviços'''
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='servicos')
    
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True, null=True, max_length=500)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.nome
    
class Projeto(models.Model):
    '''Contrato: vínculo cliente + serviço com recorrência opcional'''
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projetos')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='projetos')
    servico = models.ForeignKey(Servico, on_delete=models.CASCADE, related_name='projetos')

    mensalista = models.BooleanField(
        default=False,
        help_text='Gera cobranças MENSAL automaticamente nos meses futuros',
    )
    valor_mensal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Valor padrão das parcelas geradas automaticamente',
    )
    dia_vencimento = models.PositiveSmallIntegerField(
        default=5,
        help_text='Dia do mês (1-28) para vencimento das parcelas automáticas',
    )
    recorrencia_inicio = models.DateField(
        null=True,
        blank=True,
        help_text='Primeiro mês da recorrência automática',
    )

    criado_em = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.cliente.nome} - {self.servico.nome}"

class Pagamento(models.Model):
    # Opções simplificadas e diretas
    TIPO_PAGAMENTO_CHOICES = [
        ('MENSAL', 'Mensalidade'),
        ('QUINZENAL', 'Quinzenal'),
        ('AVULSO', 'Pagamento Avulso / Extra'),
    ]

    projeto = models.ForeignKey(Projeto, on_delete=models.CASCADE, related_name='pagamentos')
    
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    
    tipo_pagamento = models.CharField(
        max_length=10, 
        choices=TIPO_PAGAMENTO_CHOICES, 
        default='MENSAL'
    )
    
    data = models.DateField(help_text="Data do pagamento ou vencimento", db_index=True)
    observacao = models.TextField(blank=True, null=True, max_length=500)
    atualizado_em = models.DateTimeField(auto_now=True)
    referencia_mes = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        db_index=True,
        help_text='YYYY-MM para parcelas geradas automaticamente (idempotência)',
    )
    gerado_automaticamente = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['projeto', 'referencia_mes'],
                condition=models.Q(referencia_mes__isnull=False),
                name='uniq_pagamento_projeto_referencia_mes',
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_pagamento_display()}: R$ {self.valor} - {self.projeto.cliente.nome}"
