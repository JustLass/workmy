"""
Schemas e endpoints de autenticação
"""
from ninja import Router, Schema
from ninja.security import HttpBearer
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.hashers import make_password
from ninja_jwt.tokens import RefreshToken
from typing import Optional
from pydantic import Field, ConfigDict

User = get_user_model()

router = Router(tags=["Auth"])


class UserRegisterSchema(Schema):
    """Schema para registro de novo usuário"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "joao_silva",
                "email": "joao@example.com",
                "password": "senha123",
                "telefone": "+55 11 98765-4321"
            }
        }
    )
    
    username: str = Field(..., min_length=3, max_length=150, description="Nome de usuário único")
    email: str = Field(..., description="Email do usuário (deve ser único)")
    password: str = Field(..., min_length=6, description="Senha (mínimo 6 caracteres)")
    telefone: Optional[str] = Field(None, max_length=20, description="Telefone do usuário (opcional)")


class UserLoginSchema(Schema):
    """Schema para login de usuário"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "joao_silva",
                "password": "senha123"
            }
        }
    )
    
    username: str = Field(..., description="Nome de usuário")
    password: str = Field(..., description="Senha do usuário")


class UserOutSchema(Schema):
    """Schema de resposta com dados do usuário"""
    id: int = Field(..., description="ID único do usuário")
    username: str = Field(..., description="Nome de usuário")
    email: str = Field(..., description="Email do usuário")
    telefone: Optional[str] = Field(None, description="Telefone do usuário")
    foto_perfil: Optional[str] = Field(None, description="URL da foto de perfil")


class TokenResponseSchema(Schema):
    """Schema de resposta com tokens JWT e dados do usuário"""
    access: str = Field(..., description="Token de acesso JWT (validade: 1 hora)")
    refresh: str = Field(..., description="Token de refresh JWT (validade: 7 dias)")
    user: UserOutSchema = Field(..., description="Dados do usuário autenticado")


class RefreshTokenSchema(Schema):
    """Schema para renovação de token"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    )
    
    refresh: str = Field(..., description="Token de refresh JWT")


class AccessTokenSchema(Schema):
    """Schema de resposta com novo access token"""
    access: str = Field(..., description="Novo token de acesso JWT (validade: 1 hora)")


class ErrorSchema(Schema):
    """Schema de resposta de erro"""
    detail: str = Field(..., description="Mensagem de erro")


@router.post("/register", response={200: TokenResponseSchema, 400: ErrorSchema}, summary="Registrar novo usuário")
def register(request, payload: UserRegisterSchema):
    """
    Registra um novo usuário no sistema.
    
    - **username**: Nome de usuário único (mínimo 3 caracteres)
    - **email**: Email válido e único
    - **password**: Senha com mínimo 6 caracteres
    - **telefone**: Telefone opcional
    
    Retorna tokens JWT (access + refresh) e dados do usuário criado.
    """
    # Verifica se username já existe
    if User.objects.filter(username=payload.username).exists():
        return 400, {"detail": "Username já existe"}
    
    # Verifica se email já existe
    if User.objects.filter(email=payload.email).exists():
        return 400, {"detail": "Email já está em uso"}
    
    # Cria o usuário
    user = User.objects.create(
        username=payload.username,
        email=payload.email,
        password=make_password(payload.password),
        telefone=payload.telefone
    )
    
    # Gera tokens JWT
    refresh = RefreshToken.for_user(user)
    
    return 200, {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "telefone": user.telefone,
            "foto_perfil": user.foto_perfil.url if user.foto_perfil else None
        }
    }


@router.post("/login", response={200: TokenResponseSchema, 401: ErrorSchema}, summary="Login de usuário")
def login(request, payload: UserLoginSchema):
    """
    Autentica um usuário e retorna tokens JWT.
    
    - **username**: Nome de usuário registrado
    - **password**: Senha do usuário
    
    Retorna tokens JWT (access + refresh) e dados do usuário autenticado.
    """
    user = authenticate(username=payload.username, password=payload.password)
    
    if user is None:
        return 401, {"detail": "Credenciais inválidas"}
    
    # Gera tokens JWT
    refresh = RefreshToken.for_user(user)
    
    return 200, {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "telefone": user.telefone,
            "foto_perfil": user.foto_perfil.url if user.foto_perfil else None
        }
    }


@router.post("/refresh", response={200: AccessTokenSchema, 401: ErrorSchema}, summary="Renovar access token")
def refresh_token(request, payload: RefreshTokenSchema):
    """
    Renova o access token usando o refresh token.
    
    - **refresh**: Token de refresh válido
    
    Retorna um novo access token (validade: 1 hora).
    Use este endpoint quando o access token expirar.
    """
    try:
        refresh = RefreshToken(payload.refresh)
        return 200, {"access": str(refresh.access_token)}
    except Exception as e:
        return 401, {"detail": "Token inválido ou expirado"}


class AuthBearer(HttpBearer):
    """
    Classe para autenticação JWT no Ninja.
    Adicione 'auth=AuthBearer()' nos endpoints protegidos.
    """
    def authenticate(self, request, token):
        from ninja_jwt.authentication import JWTAuth
        jwt_auth = JWTAuth()
        return jwt_auth.authenticate(request, token)


@router.get("/me", response=UserOutSchema, auth=AuthBearer(), summary="Dados do usuário autenticado")
def me(request):
    """
    Retorna os dados do usuário autenticado.
    
    **Requer autenticação:** Bearer token no header Authorization.
    
    Exemplo de header:
    ```
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    ```
    """
    user = request.auth
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "telefone": user.telefone,
        "foto_perfil": user.foto_perfil.url if user.foto_perfil else None
    }

