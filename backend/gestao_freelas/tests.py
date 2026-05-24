"""
Testes para validações (P2.4) e consolidação de modelos
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

from gestao_freelas.models import Cliente, Servico, Projeto, Pagamento
from usuarios.models import Usuario


class ProjetoValidationTests(TestCase):
    """Testes para validações do modelo Projeto"""
    
    def setUp(self):
        self.user = Usuario.objects.create_user(username='testuser', password='123456', email='test@example.com')
        self.cliente = Cliente.objects.create(usuario=self.user, nome='Cliente Teste')
        self.servico = Servico.objects.create(usuario=self.user, nome='Serviço Teste')
    
    def test_projeto_valor_negativo_invalido(self):
        """Projeto com valor negativo deve falhar"""
        projeto = Projeto(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico,
            valor=Decimal('-100.00')
        )
        with self.assertRaises(ValidationError):
            projeto.clean()
    
    def test_projeto_valor_zero_invalido(self):
        """Projeto com valor zero deve falhar"""
        projeto = Projeto(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico,
            valor=Decimal('0.00')
        )
        with self.assertRaises(ValidationError):
            projeto.clean()
    
    def test_projeto_valor_positivo_valido(self):
        """Projeto com valor positivo deve passar"""
        projeto = Projeto(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico,
            valor=Decimal('1000.00')
        )
        try:
            projeto.clean()
        except ValidationError:
            self.fail("Projeto com valor positivo levantou ValidationError inesperadamente")
    

    def test_projeto_progresso_invalido_maior(self):
        """Projeto com progresso > 100 deve falhar"""
        projeto = Projeto(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico,
            progresso=101
        )
        with self.assertRaises(ValidationError):
            projeto.clean()
    
    def test_projeto_progresso_invalido_menor(self):
        """Projeto com progresso < 0 deve falhar"""
        projeto = Projeto(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico,
            progresso=-1
        )
        with self.assertRaises(ValidationError):
            projeto.clean()
    
    def test_projeto_progresso_valido(self):
        """Projeto com progresso entre 0 e 100 deve passar"""
        for progresso in [0, 50, 100]:
            projeto = Projeto(
                usuario=self.user,
                cliente=self.cliente,
                servico=self.servico,
                progresso=progresso
            )
            try:
                projeto.clean()
            except ValidationError:
                self.fail(f"Projeto com progresso {progresso} levantou ValidationError inesperadamente")


class PagamentoValidationTests(TestCase):
    """Testes para validações do modelo Pagamento"""
    
    def setUp(self):
        self.user = Usuario.objects.create_user(username='testuser', password='123456', email='test@example.com')
        self.cliente = Cliente.objects.create(usuario=self.user, nome='Cliente Teste')
        self.servico = Servico.objects.create(usuario=self.user, nome='Serviço Teste')
        self.projeto = Projeto.objects.create(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico
        )
    
    def test_pagamento_valor_negativo_invalido(self):
        """Pagamento com valor negativo deve falhar"""
        pagamento = Pagamento(
            projeto=self.projeto,
            valor=Decimal('-100.00'),
            data=timezone.now().date()
        )
        with self.assertRaises(ValidationError):
            pagamento.save()
    
    def test_pagamento_valor_zero_invalido(self):
        """Pagamento com valor zero deve falhar"""
        pagamento = Pagamento(
            projeto=self.projeto,
            valor=Decimal('0.00'),
            data=timezone.now().date()
        )
        with self.assertRaises(ValidationError):
            pagamento.save()
    
    def test_pagamento_valor_positivo_valido(self):
        """Pagamento com valor positivo deve passar"""
        pagamento = Pagamento(
            projeto=self.projeto,
            valor=Decimal('500.00'),
            data=timezone.now().date()
        )
        try:
            pagamento.save()
            self.assertTrue(pagamento.id)
        except ValidationError:
            self.fail("Pagamento com valor positivo levantou ValidationError inesperadamente")


class SoftDeleteTests(TestCase):
    """Testes para funcionalidade de soft delete"""
    
    def setUp(self):
        self.user = Usuario.objects.create_user(username='testuser', password='123456', email='test@example.com')
        self.cliente = Cliente.objects.create(usuario=self.user, nome='Cliente Teste')
    
    def test_cliente_deletado_em_null_por_padrao(self):
        """Cliente deve ter deletado_em=None por padrão"""
        self.assertIsNone(self.cliente.deletado_em)
    
    def test_cliente_pode_ser_soft_deleted(self):
        """Cliente deve poder ser soft deleted"""
        self.cliente.deletado_em = timezone.now()
        self.cliente.save()
        
        cliente_recarregado = Cliente.objects.get(pk=self.cliente.id)
        self.assertIsNotNone(cliente_recarregado.deletado_em)


class ModelConsolidationTests(TestCase):
    """Testes para consolidação de ProjetoAtivo em Projeto"""
    
    def setUp(self):
        self.user = Usuario.objects.create_user(username='testuser', password='123456', email='test@example.com')
        self.cliente = Cliente.objects.create(usuario=self.user, nome='Cliente Teste')
        self.servico = Servico.objects.create(usuario=self.user, nome='Serviço Teste')
    
    def test_projeto_tem_campos_tipo_recorrencia(self):
        """Projeto deve ter campos tipo_recorrencia e recorrencia_ativa"""
        projeto = Projeto.objects.create(
            usuario=self.user,
            cliente=self.cliente,
            servico=self.servico
        )
        
        # Verificar que os campos existem e têm valores padrão
        self.assertEqual(projeto.tipo_recorrencia, 'AVULSO')
        self.assertTrue(projeto.recorrencia_ativa)
    
    def test_projeto_tipo_recorrencia_choices(self):
        """Projeto tipo_recorrencia deve aceitar MENSAL, AVULSO"""
        for tipo in ['MENSAL', 'AVULSO']:
            projeto = Projeto.objects.create(
                usuario=self.user,
                cliente=self.cliente,
                servico=self.servico,
                tipo_recorrencia=tipo
            )
            self.assertEqual(projeto.tipo_recorrencia, tipo)
