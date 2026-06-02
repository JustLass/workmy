import os
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import bcrypt

# ---------------------------------------------------------------------------
# Chave secreta — OBRIGATÓRIA via variável de ambiente em produção.
# Em desenvolvimento, uma chave aleatória é gerada por processo (não persistente).
# Para produção, configure JWT_SECRET_KEY com:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
# ---------------------------------------------------------------------------
_secret_from_env = os.getenv("JWT_SECRET_KEY")
if not _secret_from_env:
    import sys
    if "pytest" in sys.modules or os.getenv("TESTING") == "1":
        # Em testes, usa chave fixa para reprodutibilidade
        _secret_from_env = "test_secret_key_workmy_pytest_only"
    else:
        # Em produção/dev, gera chave aleatória por processo e avisa
        _secret_from_env = secrets.token_urlsafe(64)
        import logging
        logging.getLogger(__name__).warning(
            "JWT_SECRET_KEY não configurada. Uma chave aleatória foi gerada para esta sessão. "
            "Configure JWT_SECRET_KEY para persistência entre reinicializações."
        )

SECRET_KEY: str = _secret_from_env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15   # 15 minutos — refresh silencioso via BFF
REFRESH_TOKEN_EXPIRE_DAYS = 7      # 7 dias para renovações silenciosas


def _utcnow() -> datetime:
    """Retorna o datetime atual em UTC com informação de fuso horário (timezone-aware)."""
    return datetime.now(tz=timezone.utc)


def hash_password(password: str) -> str:
    """Gera hash seguro usando bcrypt com salt."""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifica se a senha coincide com o hash seguro."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(usuario_id: int, username: str, email: str) -> str:
    """Gera token JWT contendo payload tipado, JTI único e data de expiração."""
    expire = _utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(usuario_id),
        "username": username,
        "email": email,
        "exp": expire,
        "jti": secrets.token_hex(16),   # JWT ID único — usado pela blacklist de logout
        "type": "access"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(usuario_id: int) -> str:
    """Gera token de atualização durável."""
    expire = _utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(usuario_id),
        "exp": expire,
        "jti": secrets.token_hex(16),
        "type": "refresh"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict | None:
    """Valida e decodifica chaves relativas ao payload do JWT."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

