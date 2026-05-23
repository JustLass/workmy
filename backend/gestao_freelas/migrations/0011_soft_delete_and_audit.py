# Generated migration for P2.2 - Soft Delete e Auditoria

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('gestao_freelas', '0010_consolidate_projeto_ativo'),
    ]

    operations = [
        # P2.2.1: Adicionar campo deletado_em aos modelos
        migrations.AddField(
            model_name='cliente',
            name='deletado_em',
            field=models.DateTimeField(blank=True, help_text='Data de soft delete', null=True),
        ),
        migrations.AddField(
            model_name='servico',
            name='deletado_em',
            field=models.DateTimeField(blank=True, help_text='Data de soft delete', null=True),
        ),
        migrations.AddField(
            model_name='projeto',
            name='deletado_em',
            field=models.DateTimeField(blank=True, help_text='Data de soft delete', null=True),
        ),
        migrations.AddField(
            model_name='pagamento',
            name='deletado_em',
            field=models.DateTimeField(blank=True, help_text='Data de soft delete', null=True),
        ),
        # P2.2.2: Criar modelo AuditLog
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recurso_tipo', models.CharField(help_text='Tipo de recurso (ex: Cliente, Projeto)', max_length=50)),
                ('recurso_id', models.IntegerField(help_text='ID do recurso')),
                ('acao', models.CharField(
                    choices=[('CREATE', 'Criação'), ('UPDATE', 'Atualização'), ('DELETE', 'Exclusão')],
                    help_text='Tipo de ação realizada',
                    max_length=10
                )),
                ('dados_anterior', models.JSONField(blank=True, help_text='Estado anterior do recurso', null=True)),
                ('dados_novo', models.JSONField(help_text='Estado novo do recurso')),
                ('ip_address', models.CharField(blank=True, help_text='IP do cliente', max_length=45, null=True)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('usuario', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-criado_em'],
            },
        ),
        # Adicionar índices ao AuditLog
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['recurso_tipo', 'recurso_id'], name='auditlog_recurso_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['usuario', 'criado_em'], name='auditlog_usuario_criado_idx'),
        ),
    ]
