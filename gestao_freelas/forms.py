from django import forms
from .models import Cliente, Servico, Projeto, Pagamento

class ClienteForm(forms.ModelForm):
    """
    Formulário para criação e edição de Clientes.
    
    Mapeia os campos básicos de contato (nome, email, telefone) e 
    injeta classes CSS padrão para renderização no frontend.
    """
    class Meta:
        model = Cliente
        fields = ['nome', 'email', 'telefone']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome do cliente'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email@exemplo.com'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '(11) 99999-9999'}),
        }


class ServicoForm(forms.ModelForm):
    """
    Formulário para gerenciar o catálogo de Serviços.
    
    Permite cadastrar o nome e a descrição detalhada do serviço 
    oferecido pelo freelancer, independentemente de clientes.
    """
    class Meta:
        model = Servico
        fields = ['nome', 'descricao']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Criação de Site'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Detalhes do serviço...'}),
        }


class ProjetoForm(forms.ModelForm):
    """
    Formulário para a criação de Projetos (Contratos).
    
    Atua como o formulário da tabela pivô, vinculando um Cliente existente 
    a um Serviço do catálogo para gerar uma relação de trabalho.
    """
    class Meta:
        model = Projeto
        fields = ['cliente', 'servico']
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-control'}),
            'servico': forms.Select(attrs={'class': 'form-control'}),
        }


class PagamentoForm(forms.ModelForm):
    """
    Formulário para registro de transações financeiras (Pagamentos).
    
    Vincula um valor e uma data a um Projeto específico. Possui 
    configuração de widget customizado para exibir o calendário nativo 
    do navegador no campo de data.
    """
    class Meta:
        model = Pagamento
        fields = ['projeto', 'valor', 'tipo_pagamento', 'data', 'observacao']
        widgets = {
            'projeto': forms.Select(attrs={'class': 'form-control'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'tipo_pagamento': forms.Select(attrs={'class': 'form-control'}),
            'data': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'observacao': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }