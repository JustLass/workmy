# 🔐 Documentação: Autenticação JWT no WorkMy

## O que é JWT (JSON Web Token)?

JWT é um padrão para autenticação em APIs REST. É um token codificado que contém:
- **Header**: Tipo do token (JWT) e algoritmo de criptografia (HS256)
- **Payload**: Dados do usuário (ID, username, etc)
- **Signature**: Assinatura criptografada para validar autenticidade

Formato: xxxxx.yyyyy.zzzzz

---

## 🔄 Fluxo de Autenticação JWT

1. **Usuário submete credenciais** (username + password)
2. **Backend valida** com Django authenticate()
3. **Backend gera 2 tokens** via RefreshToken.for_user():
   - **access_token**: Válido por 1 hora (para requests)
   - **refresh_token**: Válido por 7 dias (para renovar access)
4. **Frontend armazena tokens** em localStorage
5. **Frontend envia access_token** no header de cada request protegido

---

## 📋 Endpoints de Autenticação

### 1️⃣ POST /api/auth/register - Registrar Novo Usuário

**Request:**
\\\json
{
  "username": "joao_silva",
  "email": "joao@example.com",
  "password": "senha123",
  "telefone": "+55 11 98765-4321"
}
\\\

**Response (200):**
\\\json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "joao_silva",
    "email": "joao@example.com",
    "telefone": "+55 11 98765-4321",
    "foto_perfil": null
  }
}
\\\

---

### 2️⃣ POST /api/auth/login - Login

**Request:**
\\\json
{
  "username": "joao_silva",
  "password": "senha123"
}
\\\

**Response (200):**
\\\json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "joao_silva",
    "email": "joao@example.com",
    "telefone": "+55 11 98765-4321",
    "foto_perfil": "https://..."
  }
}
\\\

---

### 3️⃣ POST /api/auth/refresh - Renovar Access Token

Quando access_token expirar (1 hora), use refresh_token para gerar um novo.

**Request:**
\\\json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\\\

**Response (200):**
\\\json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\\\

---

### 4️⃣ GET /api/auth/me - Dados do Usuário Autenticado

**Headers:**
\\\
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\\\

**Response (200):**
\\\json
{
  "id": 1,
  "username": "joao_silva",
  "email": "joao@example.com",
  "telefone": "+55 11 98765-4321",
  "foto_perfil": "https://..."
}
\\\

---

## ⚙️ Configurações JWT em settings.py

\\\python
from datetime import timedelta

NINJA_JWT = {
    # Tempo de vida dos tokens
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),      # Access expira em 1 hora
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),      # Refresh expira em 7 dias
    
    # Segurança
    'ROTATE_REFRESH_TOKENS': True,                    # Novo refresh a cada uso
    'BLACKLIST_AFTER_ROTATION': True,                 # Invalida refresh antigo
    
    # Configuração criptográfica
    'ALGORITHM': 'HS256',                             # HMAC-SHA256
    'SIGNING_KEY': SECRET_KEY,                        # Chave secreta do Django
    
    # Headers
    'AUTH_HEADER_TYPES': ('Bearer',),                 # Formato: Bearer <token>
    
    # Claims do JWT
    'USER_ID_FIELD': 'id',                            # Campo ID do usuário
    'USER_ID_CLAIM': 'user_id',                       # Nome da claim
}
\\\

### O que cada config faz:

| Config | Função |
|--------|--------|
| ACCESS_TOKEN_LIFETIME | Define expiração do access token (1 hora) |
| REFRESH_TOKEN_LIFETIME | Define expiração do refresh token (7 dias) |
| ROTATE_REFRESH_TOKENS | A cada refresh, gera um novo refresh token |
| BLACKLIST_AFTER_ROTATION | O refresh antigo é invalidado (segurança) |
| ALGORITHM | Tipo de criptografia: HS256 (simétrica) |
| SIGNING_KEY | Chave usada para assinar tokens |

---

## 🔗 CORS - Conectar com Frontend

\\\python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',           # React dev
    'http://localhost:5173',           # Vite dev
    'https://seu-frontend.vercel.app'  # Produção
]

CORS_ALLOW_CREDENTIALS = True  # Permite headers de credenciais
\\\

---

## 🛡️ Proteger Endpoints com Autenticação

No arquivo do seu router (ex: api/clientes.py):

\\\python
from api.auth import AuthBearer

@router.get("/", auth=AuthBearer())
def listar_clientes(request):
    # request.auth = usuário autenticado
    user = request.auth
    
    clientes = Cliente.objects.filter(usuario=user)
    return clientes
\\\

O parâmetro uth=AuthBearer() força autenticação no endpoint!

---

## 📱 Exemplo Completo em JavaScript/React

### 1️⃣ Fazer Login e Armazenar Tokens

\\\javascript
async function login(username, password) {
  const response = await fetch('http://localhost:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    console.error('Erro ao fazer login');
    return;
  }

  const data = await response.json();
  
  // Armazenar tokens
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  localStorage.setItem('user', JSON.stringify(data.user));
  
  console.log('Login realizado! Bem-vindo', data.user.username);
}
\\\

### 2️⃣ Usar Token em Requisições Protegidas

\\\javascript
async function fetchClientes() {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch('http://localhost:8000/api/clientes/', {
    method: 'GET',
    headers: {
      'Authorization': \Bearer \\,  // ← Token aqui!
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 401) {
    console.log('Token expirou. Renovando...');
    await renovarToken();
    return fetchClientes(); // Tentar novamente
  }

  return response.json();
}
\\\

### 3️⃣ Renovar Token Quando Expirar

\\\javascript
async function renovarToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('http://localhost:8000/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken })
  });

  if (!response.ok) {
    // Refresh token também expirou, fazer login novamente
    console.log('Sessão expirada. Faça login novamente.');
    logout();
    return;
  }

  const data = await response.json();
  localStorage.setItem('access_token', data.access);
  console.log('Token renovado com sucesso!');
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
\\\

### 4️⃣ Hook React para Autenticação

\\\javascript
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return { user, isLoading, login, logout };
}
\\\

---

## 🔑 Segurança

### ✅ O que está Protegido

1. **SECRET_KEY**: Criptografa os tokens
   - Em produção, usar variável de ambiente
   - Nunca deixar valor padrão no código

2. **HTTPS em Produção**: Tokens transmitidos apenas em HTTPS
   - \SECURE_SSL_REDIRECT = True\
   - \SESSION_COOKIE_SECURE = True\

3. **Expiração de Tokens**: Access token válido apenas 1 hora
   - Força renovação frequente com refresh token
   - Limita dano em caso de vazamento

4. **Token Rotation**: Novo refresh token a cada renovação
   - Token antigo é blacklisted
   - Previne reutilização de tokens vazados

---

## ⚠️ Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| 401 Unauthorized | Token não enviado | Adicione header: Authorization: Bearer <token> |
| Token inválido | Access expirou | Use /api/auth/refresh com refresh token |
| Credenciais inválidas | Username/password errado | Verifique cadastro ou registre novo usuário |
| CORS error | Frontend não autorizado | Adicione a URL do frontend em CORS_ALLOWED_ORIGINS |

---

## 📊 Estrutura Técnica

- **Biblioteca**: django-ninja (REST) + ninja-jwt (autenticação)
- **Algoritmo**: HS256 (HMAC-SHA256) - simétrico
- **Flow**: OAuth2 Implicit com tokens JWT de curta duração
- **Storage Frontend**: localStorage (ou sessionStorage para maior segurança)
- **Renovação**: Automática via refresh_token

