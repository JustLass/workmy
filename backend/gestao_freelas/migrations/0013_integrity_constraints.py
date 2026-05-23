# Generated migration for P2.4 - Constraints de Integridade

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('gestao_freelas', '0012_add_performance_indexes'),
    ]

    operations = [
        # P2.4: Constraints de integridade foram adicionados aos modelos via validadores clean()
        # - Projeto.clean(): Valida data_entrega > hoje, valor > 0, progresso 0-100
        # - Pagamento.clean(): Valida valor > 0
        # - Pagamento.save(): Chama full_clean() antes de salvar para garantir validação
        # 
        # Estas validações são executadas ao nível da aplicação (ORM)
        # Não requer alterações na migration pois os validadores estão nos modelos
    ]
