"""
Schemas e endpoints de autenticação
"""
from ninja import Router, Schema
from ninja.security import HttpBearer
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.hashers import make_password
from ninja_jwt.tokens import RefreshToken
from typing import Optional

User = get_user_model()

router = Router(tags=["Auth"])


class UserRegisterSchema(Schema):
    username: str
    email: str
    password: str
    telefone: Optional[str] = None


class UserLoginSchema(Schema):
    username: str
    password: str


class UserOutSchema(Schema):
    id: int
    username: str
    email: str
    telefone: Optional[str] = None
    foto_perfil: Optional[str] = None


class TokenResponseSchema(Schema):
    access: str
    refresh: str
    user: UserOutSchema


@router.post("/register", response=TokenResponseSchema)
def register(request, payload: UserRegisterSchema):
    """
    Endpoint para registro de novo usuário
    """
    # Verifica se username já existe
    if User.objects.filter(username=payload.username).exists():
        return router.create_response(
            request,
            {"detail": "Username já existe"},
            status=400
        )
    
    # Verifica se email já existe
    if User.objects.filter(email=payload.email).exists():
        return router.create_response(
            request,
            {"detail": "Email já está em uso"},
            status=400
        )
    
    # Cria o usuário
    user = User.objects.create(
        username=payload.username,
        email=payload.email,
        password=make_password(payload.password),
        telefone=payload.telefone
    )
    
    # Gera tokens JWT
    refresh = RefreshToken.for_user(user)
    
    return {
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


@router.post("/login", response=TokenResponseSchema)
def login(request, payload: UserLoginSchema):
    """
    Endpoint para login de usuário
    """
    user = authenticate(username=payload.username, password=payload.password)
    
    if user is None:
        return router.create_response(
            request,
            {"detail": "Credenciais inválidas"},
            status=401
        )
    
    # Gera tokens JWT
    refresh = RefreshToken.for_user(user)
    
    return {
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


class RefreshTokenSchema(Schema):
    refresh: str


class AccessTokenSchema(Schema):
    access: str


@router.post("/refresh", response=AccessTokenSchema)
def refresh_token(request, payload: RefreshTokenSchema):
    """
    Endpoint para renovar access token
    """
    try:
        refresh = RefreshToken(payload.refresh)
        return {"access": str(refresh.access_token)}
    except Exception as e:
        return router.create_response(
            request,
            {"detail": "Token inválido ou expirado"},
            status=401
        )


class AuthBearer(HttpBearer):
    """
    Classe para autenticação JWT no Ninja
    """
    def authenticate(self, request, token):
        from ninja_jwt.authentication import JWTAuth
        jwt_auth = JWTAuth()
        return jwt_auth.authenticate(request, token)


@router.get("/me", response=UserOutSchema, auth=AuthBearer())
def me(request):
    """
    Retorna dados do usuário autenticado
    """
    user = request.auth
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "telefone": user.telefone,
        "foto_perfil": user.foto_perfil.url if user.foto_perfil else None
    }

