# Generated migration for P2.3 - Adicionar Índices de Performance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao_freelas', '0011_soft_delete_and_audit'),
    ]

    operations = [
        # P2.3: Adicionar índices aos modelos para performance
        # Índices para Cliente
        migrations.AddIndex(
            model_name='cliente',
            index=models.Index(fields=['usuario', 'criado_em'], name='cliente_usuario_criado_idx'),
        ),
        
        # Índices para Servico
        migrations.AddIndex(
            model_name='servico',
            index=models.Index(fields=['usuario', 'criado_em'], name='servico_usuario_criado_idx'),
        ),
        
        # Índices para Projeto
        migrations.AddIndex(
            model_name='projeto',
            index=models.Index(fields=['usuario', 'status'], name='projeto_usuario_status_idx'),
        ),
        migrations.AddIndex(
            model_name='projeto',
            index=models.Index(fields=['usuario', 'criado_em'], name='projeto_usuario_criado_idx'),
        ),
        migrations.AddIndex(
            model_name='projeto',
            index=models.Index(fields=['cliente', 'status'], name='projeto_cliente_status_idx'),
        ),
        
        # Índices para Pagamento
        migrations.AddIndex(
            model_name='pagamento',
            index=models.Index(fields=['projeto', 'data'], name='pagamento_projeto_data_idx'),
        ),
        migrations.AddIndex(
            model_name='pagamento',
            index=models.Index(fields=['referencia_mes'], name='pagamento_referencia_mes_idx'),
        ),
    ]
