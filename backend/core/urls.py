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
from django.urls import path

# Estas duas importações são obrigatórias para as imagens funcionarem
from django.conf import settings
from django.conf.urls.static import static

# Importa a API versão 1 (v0 mantida para compatibilidade)
from api.api_v1 import api_v1
from api.api import api as api_v0  # Legacy: será descontinuada

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API REST - Versão 1 (ATUAL)
    path('api/v1/', api_v1.urls),
    
    # API REST - Versão 0 (LEGACY - deprecated em v2.0)
    path('api/', api_v0.urls),
    
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
