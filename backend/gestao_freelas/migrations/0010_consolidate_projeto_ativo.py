# Generated migration for P2.1 - Consolidar ProjetoAtivo em Projeto

import django.db.models.deletion
from django.db import migrations, models


def copy_projeto_ativo_data(apps, schema_editor):
    """Copia dados de ProjetoAtivo para Projeto se existirem"""
    Projeto = apps.get_model('gestao_freelas', 'Projeto')
    ProjetoAtivo = apps.get_model('gestao_freelas', 'ProjetoAtivo')
    
    for projeto_ativo in ProjetoAtivo.objects.all():
        projeto = projeto_ativo.projeto
        projeto.tipo_recorrencia = projeto_ativo.tipo_recorrencia
        projeto.recorrencia_ativa = projeto_ativo.ativo
        projeto.save()


def reverse_copy_projeto_ativo_data(apps, schema_editor):
    """Reverte a cópia de dados"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('gestao_freelas', '0009_projeto_data_entrega_projeto_progresso_and_more'),
    ]

    operations = [
        # P2.1: Adicionar campos novos ao Projeto
        migrations.AddField(
            model_name='projeto',
            name='tipo_recorrencia',
            field=models.CharField(
                choices=[('MENSAL', 'Mensal'), ('QUINZENAL', 'Quinzenal'), ('AVULSO', 'Sem Recorrência / Avulso')],
                default='AVULSO',
                help_text='Tipo de recorrência do projeto',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='projeto',
            name='recorrencia_ativa',
            field=models.BooleanField(default=True, help_text='Se a recorrência está ativa'),
        ),
        # Copiar dados de ProjetoAtivo para Projeto
        migrations.RunPython(copy_projeto_ativo_data, reverse_copy_projeto_ativo_data),
    ]
