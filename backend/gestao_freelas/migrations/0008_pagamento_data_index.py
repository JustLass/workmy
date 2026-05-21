from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestao_freelas', '0007_projeto_recorrencia_pagamento_referencia'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pagamento',
            name='data',
            field=models.DateField(db_index=True, help_text='Data do pagamento ou vencimento'),
        ),
    ]
