from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

# Create your models here.

class Cliente(models.Model):
    '''Tabela de clientes'''
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='clientes')
    
    nome = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    deletado_em = models.DateTimeField(null=True, blank=True, help_text='Data de soft delete')
    
    class Meta:
        indexes = [
            models.Index(fields=['usuario', 'criado_em'], name='cliente_usuario_criado_idx'),
        ]
    
    def __str__(self):
            return self.nome
        
class Servico(models.Model):
    '''Tabela de serviços'''
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='servicos')
    
    nome = models.CharField(max_length=150)
    descricao = models.TextField(blank=True, null=True, max_length=500)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    deletado_em = models.DateTimeField(null=True, blank=True, help_text='Data de soft delete')
    
    class Meta:
        indexes = [
            models.Index(fields=['usuario', 'criado_em'], name='servico_usuario_criado_idx'),
        ]
    
    def __str__(self):
        return self.nome
    
class Projeto(models.Model):
    '''Contrato: vínculo cliente + serviço com recorrência opcional'''
    STATUS_CHOICES = [
        ('DISCOVERY', 'In Discovery'),
        ('IN_PROGRESS', 'In Progress'),
        ('REVIEW', 'Review'),
        ('COMPLETED', 'Completed'),
    ]
    
    TIPO_RECORRENCIA_CHOICES = [
        ('MENSAL', 'Mensal'),
        ('QUINZENAL', 'Quinzenal'),
        ('AVULSO', 'Sem Recorrência / Avulso'),
    ]

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projetos')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='projetos')
    servico = models.ForeignKey(Servico, on_delete=models.CASCADE, related_name='projetos')

    # Novos campos para fluxo Kanban
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DISCOVERY',
        help_text='Etapa atual do projeto no quadro Kanban',
    )
    progresso = models.PositiveSmallIntegerField(
        default=0,
        help_text='Progresso estimado de entrega (0 a 100)',
    )
    data_entrega = models.DateField(
        null=True,
        blank=True,
        help_text='Data limite para entrega do projeto',
    )
    valor = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Valor total do contrato/projeto',
    )

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
    
    # Campos consolidados de ProjetoAtivo (P2.1)
    tipo_recorrencia = models.CharField(
        max_length=20,
        choices=TIPO_RECORRENCIA_CHOICES,
        default='AVULSO',
        help_text='Tipo de recorrência do projeto'
    )
    recorrencia_ativa = models.BooleanField(
        default=True,
        help_text='Se a recorrência está ativa'
    )

    criado_em = models.DateTimeField(auto_now_add=True)
    deletado_em = models.DateTimeField(null=True, blank=True, help_text='Data de soft delete')
    
    class Meta:
        indexes = [
            models.Index(fields=['usuario', 'status'], name='projeto_usuario_status_idx'),
            models.Index(fields=['usuario', 'criado_em'], name='projeto_usuario_criado_idx'),
            models.Index(fields=['cliente', 'status'], name='projeto_cliente_status_idx'),
        ]
    
    def clean(self):
        """Valida os dados do projeto (P2.4)"""
        if self.data_entrega and self.data_entrega < timezone.now().date():
            raise ValidationError({'data_entrega': 'Data de entrega não pode ser no passado'})
        if self.valor is not None and self.valor <= 0:
            raise ValidationError({'valor': 'Valor deve ser maior que zero'})
        if not (0 <= self.progresso <= 100):
            raise ValidationError({'progresso': 'Progresso deve estar entre 0 e 100'})
    
    def __str__(self):
        return f"{self.cliente.nome} - {self.servico.nome}"


class ProjetoAtivo(models.Model):
    '''DEPRECATED: Consolidado em Projeto. Este modelo será removido em versão futura.'''
    TIPO_RECORRENCIA_CHOICES = [
        ('MENSAL', 'Mensal'),
        ('QUINZENAL', 'Quinzenal'),
        ('AVULSO', 'Sem Recorrência / Avulso'),
    ]
    projeto = models.OneToOneField(Projeto, on_delete=models.CASCADE, related_name='projeto_ativo')
    tipo_recorrencia = models.CharField(max_length=20, choices=TIPO_RECORRENCIA_CHOICES, default='AVULSO')
    ativo = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "ProjetoAtivo (DEPRECATED)"
        verbose_name_plural = "ProjetosAtivos (DEPRECATED)"
    
    def __str__(self):
        return f"{self.projeto} - {self.get_tipo_recorrencia_display()} - {'Ativo' if self.ativo else 'Inativo'} [DEPRECATED]"


class AuditLog(models.Model):
    '''Registro de auditoria para rastreamento de mudanças (P2.2)'''
    ACAO_CHOICES = [
        ('CREATE', 'Criação'),
        ('UPDATE', 'Atualização'),
        ('DELETE', 'Exclusão'),
    ]
    
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    recurso_tipo = models.CharField(max_length=50, help_text='Tipo de recurso (ex: Cliente, Projeto)')
    recurso_id = models.IntegerField(help_text='ID do recurso')
    acao = models.CharField(max_length=10, choices=ACAO_CHOICES, help_text='Tipo de ação realizada')
    dados_anterior = models.JSONField(null=True, blank=True, help_text='Estado anterior do recurso')
    dados_novo = models.JSONField(help_text='Estado novo do recurso')
    ip_address = models.CharField(max_length=45, blank=True, null=True, help_text='IP do cliente')
    criado_em = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['recurso_tipo', 'recurso_id'], name='auditlog_recurso_idx'),
            models.Index(fields=['usuario', 'criado_em'], name='auditlog_usuario_criado_idx'),
        ]
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.acao} {self.recurso_tipo}#{self.recurso_id} por {self.usuario} em {self.criado_em}"


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
    deletado_em = models.DateTimeField(null=True, blank=True, help_text='Data de soft delete')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['projeto', 'referencia_mes'],
                condition=models.Q(referencia_mes__isnull=False),
                name='uniq_pagamento_projeto_referencia_mes',
            ),
        ]
        indexes = [
            models.Index(fields=['projeto', 'data'], name='pagamento_projeto_data_idx'),
            models.Index(fields=['referencia_mes'], name='pagamento_referencia_mes_idx'),
        ]

    def clean(self):
        """Valida os dados do pagamento (P2.4)"""
        if self.valor <= 0:
            raise ValidationError({'valor': 'Valor deve ser maior que zero'})
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_tipo_pagamento_display()}: R$ {self.valor} - {self.projeto.cliente.nome}"
