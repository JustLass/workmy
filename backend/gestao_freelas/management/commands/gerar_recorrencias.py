"""
Job para Render cron / execução manual: estende parcelas mensais idempotentes.

  python manage.py gerar_recorrencias
  python manage.py gerar_recorrencias --usuario-id=1
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from gestao_freelas.models import Projeto
from gestao_freelas.services.recorrencia import gerar_parcelas_mensais

User = get_user_model()


class Command(BaseCommand):
    help = 'Gera cobranças mensais futuras para contratos mensalistas (idempotente).'

    def add_arguments(self, parser):
        parser.add_argument('--usuario-id', type=int, default=None)

    def handle(self, *args, **options):
        usuario_id = options['usuario_id']
        usuarios = User.objects.filter(id=usuario_id) if usuario_id else User.objects.all()

        total_criados = 0
        total_projetos = 0

        for usuario in usuarios:
            projetos = Projeto.objects.filter(usuario=usuario, mensalista=True)
            for projeto in projetos:
                resultado = gerar_parcelas_mensais(projeto)
                total_projetos += 1
                total_criados += resultado['criados']
                self.stdout.write(
                    f'  projeto {projeto.id}: +{resultado["criados"]} '
                    f'(já existiam {resultado["existentes"]})'
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Concluído: {total_projetos} contrato(s), {total_criados} parcela(s) nova(s).'
            )
        )
