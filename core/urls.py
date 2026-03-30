"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

# Estas duas importações são obrigatórias para as imagens funcionarem
from django.conf import settings
from django.conf.urls.static import static

# Importa a API do Ninja
from api.api import api

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API REST
    path('api/', api.urls),
    
    # Rotas antigas (monolito) - manter por enquanto
    path('', include('usuarios.urls')),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)