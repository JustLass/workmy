# ⚠️ CHECKLIST PRÉ-DEPLOY - WorkMy API

## 🔴 CRÍTICO - Corrigir ANTES do Merge

### 1. SECRET_KEY Fraca
**Status:** ❌ INSEGURO  
**Problema:** Usando SECRET_KEY de 9 bytes no .env
```env
# .env (ATUAL)
SECRET_KEY=123456789  # ❌ PERIGOSO!
```

**Solução:**
```bash
# Gerar nova chave
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

**Ação no Render:**
- Adicionar variável de ambiente `SECRET_KEY` com valor gerado
- NÃO commitar a chave no .env!

---

### 2. ALLOWED_HOSTS Aberto
**Status:** ❌ INSEGURO  
**Problema:** Aceita qualquer host (`ALLOWED_HOSTS = ['*']`)

**Solução:**
```python
# settings.py
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')
```

**Ação no Render:**
- Adicionar variável: `ALLOWED_HOSTS=seu-app.onrender.com,localhost`

---

### 3. DEBUG em Produção
**Status:** ⚠️ VERIFICAR  
**Problema:** .env tem `DEBUG=True`

**Solução no Render:**
- Variável: `DEBUG=False`
- NUNCA deixar True em produção!

---

### 4. DATABASE_URL
**Status:** ⚠️ COMENTADO  
**Problema:** PostgreSQL comentado no .env

**Ação no Render:**
- Variável: `DATABASE_URL=postgresql://postgres.jjzcvpcdhokfinzvaamf:EKEfHZdJDUExfl8h@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`
- OU criar novo PostgreSQL no Render

---

### 5. CORS para Frontend
**Status:** ⚠️ SÓ LOCALHOST  
**Problema:** CORS só aceita localhost

**Solução:**
```python
# settings.py
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173'
).split(',')
```

**Ação no Render quando tiver frontend:**
- Adicionar domínio Vercel: `CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app,http://localhost:3000`

---

## 🟠 IMPORTANTE - Adicionar Antes do Deploy

### 6. HTTPS Obrigatório
```python
# settings.py - adicionar no final
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
```

### 7. Gunicorn (Web Server)
```bash
# Verificar se está no requirements.txt
pip freeze | grep gunicorn
```

Se não tiver:
```bash
uv add gunicorn
```

### 8. WhiteNoise (Arquivos Estáticos)
✅ Já está configurado no middleware

---

## 📋 Variáveis de Ambiente no Render

Configure estas variáveis no Render Dashboard:

```env
# Segurança
DEBUG=False
SECRET_KEY=<gerar-chave-forte-50-caracteres>
ALLOWED_HOSTS=seu-app.onrender.com

# Database
DATABASE_URL=postgresql://...supabase... (ou Render PostgreSQL)

# CORS (atualizar quando tiver frontend)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Opcional
DJANGO_SETTINGS_MODULE=core.settings
PYTHON_VERSION=3.11.7
```

---

## 🚀 Comandos no Render

### Build Command:
```bash
./build.sh
```

### Start Command:
```bash
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
```

---

## ✅ Checklist Final

Antes de fazer merge com `main`:

- [ ] Gerar SECRET_KEY forte
- [ ] Atualizar ALLOWED_HOSTS no settings.py
- [ ] Atualizar CORS_ALLOWED_ORIGINS no settings.py
- [ ] Adicionar configurações HTTPS no settings.py
- [ ] Verificar gunicorn no requirements.txt
- [ ] NÃO commitar .env com secrets
- [ ] Configurar variáveis no Render Dashboard
- [ ] Testar deploy em branch separada primeiro

---

## 🎯 Pós-Deploy

Após deploy bem-sucedido:

1. **Criar superuser:**
```bash
# No Render Shell
python manage.py createsuperuser
```

2. **Testar endpoints:**
- GET https://seu-app.onrender.com/api/docs
- POST https://seu-app.onrender.com/api/auth/register

3. **Verificar logs:**
- Render Dashboard > Logs

4. **Atualizar frontend quando pronto:**
- Adicionar domínio Vercel no CORS_ALLOWED_ORIGINS
- Redeploy

---

## 🔒 Melhorias Futuras (não bloqueantes)

- [ ] Rate Limiting (django-ratelimit)
- [ ] Logging estruturado (django-log-request-id)
- [ ] Monitoramento (Sentry)
- [ ] Backup automático do banco
- [ ] CDN para arquivos estáticos
