# 🔒 SEGURANÇA - Implementações Antes do Deploy

**Data:** 31/03/2026  
**Status:** ✅ IMPLEMENTADO

---

## 1. 🔐 Rate Limiting (Proteção contra Brute Force)

### ✅ Status: IMPLEMENTADO
**Biblioteca:** django-ratelimit 4.1.0  
**Arquivo:** api/auth.py

### Proteção por Endpoint:

#### POST /api/auth/login
\\\
Limite: 5 tentativas por minuto por IP
Resposta: HTTP 429 Too Many Requests
Uso: Impede ataques de força bruta
\\\

**Exemplo de erro:**
\\\json
{
  "detail": "Rate limit exceeded. Try again in 60 seconds."
}
\\\

#### POST /api/auth/register
\\\
Limite: 3 registros por hora por IP
Resposta: HTTP 429 Too Many Requests
Uso: Impede criação massiva de contas
\\\

#### POST /api/auth/refresh
\\\
Limite: 10 tentativas por minuto por IP
Resposta: HTTP 429 Too Many Requests
Uso: Proteção adicional contra abuse
\\\

### Implementação Técnica:

\\\python
from ratelimit.decorators import ratelimit

@router.post("/login")
@ratelimit(key='ip', rate='5/m', method='POST')
def login(request, payload: UserLoginSchema):
    # ... código
\\\

### Como Funciona:

1. **Detecta IP do Cliente**
   - Verifica header X-Forwarded-For (proxies)
   - Fallback para REMOTE_ADDR

2. **Cache em Memória**
   - Rastreia requisições por IP
   - Django cache padrão (locmem)

3. **Reset Automático**
   - Login: a cada 60 segundos
   - Register: a cada 1 hora
   - Refresh: a cada 60 segundos

### Teste Local:

\\\ash
# Fazer 6 requisições em menos de 1 minuto
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"username":"teste","password":"senha"}'
  echo "Tentativa ..."
done

# Será bloqueado na 6ª tentativa (HTTP 429)
\\\

---

## 2. 🔗 HTTPS Obrigatório em Produção

### ✅ Status: IMPLEMENTADO
**Arquivo:** core/settings.py (linhas 192-201)

### Configurações Ativadas:

\\\python
if not DEBUG:
    # Redireciona HTTP para HTTPS
    SECURE_SSL_REDIRECT = True
    
    # Cookies só trafegam em HTTPS
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    # HSTS (HTTP Strict Transport Security)
    SECURE_HSTS_SECONDS = 31536000  # 1 ano
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    
    # Headers de segurança adicionais
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
\\\

### O que Cada Config Faz:

| Config | Função | Impacto |
|--------|--------|--------|
| SECURE_SSL_REDIRECT | Redireciona HTTP → HTTPS | Força conexão segura |
| SESSION_COOKIE_SECURE | Cookies só em HTTPS | Impede man-in-the-middle |
| CSRF_COOKIE_SECURE | Token CSRF só em HTTPS | Protege contra CSRF |
| SECURE_HSTS_SECONDS | HSTS habilitado por 1 ano | Browser força HTTPS |
| SECURE_HSTS_INCLUDE_SUBDOMAINS | HSTS nos subdomínios | Protege *.seu-app.com |
| SECURE_HSTS_PRELOAD | Chrome preload list | Máxima proteção |
| SECURE_BROWSER_XSS_FILTER | Bloqueia XSS no browser | Impede javascript malicioso |
| SECURE_CONTENT_TYPE_NOSNIFF | Impede MIME sniffing | Força Content-Type correto |
| X_FRAME_OPTIONS = DENY | Bloqueia iframes | Impede clickjacking |

### Comportamento em Produção:

`
Cliente           Render
   │
   ├─ GET http://seu-app.onrender.com
   │  (HTTP)
   │
   └─ ← 301 Moved Permanently
      Location: https://seu-app.onrender.com
      
   ├─ GET https://seu-app.onrender.com
   │  (HTTPS) ✅
   │
   └─ ← 200 OK
      (Conexão segura com TLS/SSL)
`

### Verificar HTTPS (Após Deploy):

\\\ash
# 1. Acessar seu endpoint
curl -v https://seu-app.onrender.com/api/docs

# 2. Verificar certificado
openssl s_client -connect seu-app.onrender.com:443

# 3. Verificar headers de segurança
curl -i https://seu-app.onrender.com/api/docs | grep -i secure
\\\

---

## 3. 📊 Comparação Antes vs Depois

| Aspecto | Antes ❌ | Depois ✅ |
|--------|---------|---------|
| **Brute Force** | Sem proteção | 5/min rate limit |
| **Spam** | Registro ilimitado | 3/h rate limit |
| **HTTP** | Permitido | Redireciona para HTTPS |
| **Tokens** | Podem trafegar em HTTP | Apenas em HTTPS |
| **HSTS** | Não configurado | 1 ano + preload |
| **XSS** | Vulnerável | Bloqueado |
| **Clickjacking** | Vulnerável | X-Frame-Options: DENY |
| **MIME Sniffing** | Possível | Bloqueado |

---

## 4. 🎯 Situação PRÉ-DEPLOY

### Rate Limiting ✅
- [x] django-ratelimit instalado (requirements.txt)
- [x] Decorator @ratelimit em /login (5/m)
- [x] Decorator @ratelimit em /register (3/h)
- [x] Decorator @ratelimit em /refresh (10/m)
- [x] Respostas HTTP 429 documentadas

### HTTPS ✅
- [x] SECURE_SSL_REDIRECT = True
- [x] SESSION_COOKIE_SECURE = True
- [x] CSRF_COOKIE_SECURE = True
- [x] SECURE_HSTS_SECONDS = 31536000
- [x] SECURE_HSTS_INCLUDE_SUBDOMAINS = True
- [x] SECURE_HSTS_PRELOAD = True
- [x] SECURE_BROWSER_XSS_FILTER = True
- [x] SECURE_CONTENT_TYPE_NOSNIFF = True
- [x] X_FRAME_OPTIONS = 'DENY'

### Crítico para Render ❌
- [ ] SECRET_KEY forte (gerar)
- [ ] DEBUG = False (Render env)
- [ ] ALLOWED_HOSTS = seu-app.onrender.com
- [ ] DATABASE_URL configuração
- [ ] CORS_ALLOWED_ORIGINS atualizado

---

## 5. 📝 Próximos Passos

### Antes de Deploy:
1. Gerar SECRET_KEY forte
2. Definir variáveis no Render
3. Testar rate limiting localmente
4. Fazer deploy

### Após Deploy:
1. Verificar HTTPS
2. Testar rate limit em produção
3. Verificar headers de segurança
4. Configurar header CSP (Content-Security-Policy)

### Melhorias Futuras:
- [ ] Implement CORS preflight caching
- [ ] Add request logging para monitoramento
- [ ] Rate limiting por username (além de IP)
- [ ] 2FA (two-factor authentication)
- [ ] Account lockout temporal
- [ ] Sentry para erro tracking

---

## 6. 🔍 Validação e Teste

### Teste de Rate Limit (local):

\\\ash
# Instalar requisite
pip install requests

# Script Python para testar
python << 'TEST'
import requests
import time

url = "http://localhost:8000/api/auth/login"
payload = {"username": "teste", "password": "senha"}

print("Testando rate limit em /login (5/minuto)...")
for i in range(7):
    response = requests.post(url, json=payload)
    print(f"Tentativa {i+1}: {response.status_code}")
    if response.status_code == 429:
        print("✅ Rate limit ativado!")
        break
TEST
\\\

### Teste de HTTPS (após deploy):

\\\ash
# Verificar redirecionamento HTTP -> HTTPS
curl -i http://seu-app.onrender.com/api/docs
# Deve retornar 301 com Location: https://...

# Verificar header HSTS
curl -i https://seu-app.onrender.com/api/docs | grep Strict-Transport-Security
# Esperado: max-age=31536000; includeSubDomains; preload
\\\

---

## 📚 Referências

- [django-ratelimit](https://django-ratelimit.readthedocs.io/)
- [OWASP - Brute Force Protection](https://cheatsheetseries.owasp.org/)
- [Django Security Docs](https://docs.djangoproject.com/en/6.0/topics/security/)
- [Mozilla Web Security](https://infosec.mozilla.org/)

