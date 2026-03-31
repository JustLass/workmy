from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gestao_freelas", "0002_cliente_usuario_projeto_usuario_servico_usuario"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cliente",
            name="email",
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AlterField(
            model_name="cliente",
            name="telefone",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
