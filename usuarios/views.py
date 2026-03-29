from django.shortcuts import render, redirect
from .forms import UsuarioRegistroForm

def registro(request):
    """
    View responsável por cadastrar novos usuários e salvar a foto de perfil.
    """
    if request.method == 'POST':
        # ATENÇÃO AQUI: Adicionamos o request.FILES para ele capturar a imagem
        form = UsuarioRegistroForm(request.POST, request.FILES)
        
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UsuarioRegistroForm()
        
    return render(request, 'usuarios/registro.html', {'form': form})