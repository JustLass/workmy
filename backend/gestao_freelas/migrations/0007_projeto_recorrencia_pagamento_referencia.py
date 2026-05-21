# Generated manually for recorrência mensal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao_freelas', '0006_pagamento_atualizado_em'),
    ]

    operations = [
        migrations.AddField(
            model_name='projeto',
            name='mensalista',
            field=models.BooleanField(
                default=False,
                help_text='Gera cobranças MENSAL automaticamente nos meses futuros',
            ),
        ),
        migrations.AddField(
            model_name='projeto',
            name='valor_mensal',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Valor padrão das parcelas geradas automaticamente',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='projeto',
            name='dia_vencimento',
            field=models.PositiveSmallIntegerField(
                default=5,
                help_text='Dia do mês (1-28) para vencimento das parcelas automáticas',
            ),
        ),
        migrations.AddField(
            model_name='projeto',
            name='recorrencia_inicio',
            field=models.DateField(
                blank=True,
                help_text='Primeiro mês da recorrência automática',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='pagamento',
            name='referencia_mes',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='YYYY-MM para parcelas geradas automaticamente (idempotência)',
                max_length=7,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='pagamento',
            name='gerado_automaticamente',
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name='pagamento',
            constraint=models.UniqueConstraint(
                condition=models.Q(('referencia_mes__isnull', False)),
                fields=('projeto', 'referencia_mes'),
                name='uniq_pagamento_projeto_referencia_mes',
            ),
        ),
    ]
