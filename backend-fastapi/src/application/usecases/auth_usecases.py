from typing import Tuple
from src.domain.entities.usuario import UsuarioEntity
from src.domain.exceptions.business_exceptions import ValidaEntidadeException, NaoEncontradoException
from src.application.ports.outbound.i_usuario_repository import IUsuarioRepository
from src.application.ports.outbound.i_password_hasher import IPasswordHasher
from src.application.ports.outbound.i_token_service import ITokenService

class AuthUseCases:
    def __init__(
        self,
        usuario_repo: IUsuarioRepository,
        password_hasher: IPasswordHasher,
        token_service: ITokenService
    ):
        self.usuario_repo = usuario_repo
        self.password_hasher = password_hasher
        self.token_service = token_service

    async def registrar(self, username: str, email: str, password_raw: str, telefone: str | None = None) -> Tuple[UsuarioEntity, str, str]:
        # 1. Validações de unicidade
        if await self.usuario_repo.get_by_username(username):
            raise ValidaEntidadeException("Nome de usuário já está em uso.")
        if await self.usuario_repo.get_by_email(email):
            raise ValidaEntidadeException("E-mail já está cadastrado.")

        # 2. Cria Entidade e Hash
        novo_usuario = UsuarioEntity(
            username=username,
            email=email,
            telefone=telefone,
            password_hash=self.password_hasher.hash(password_raw)
        )
        novo_usuario.validate()

        # 3. Salva
        usuario_salvo = await self.usuario_repo.save(novo_usuario)

        # 4. Emite Tokens
        access = self.token_service.create_access_token(usuario_salvo.id, usuario_salvo.username, usuario_salvo.email)
        refresh = self.token_service.create_refresh_token(usuario_salvo.id)

        return usuario_salvo, access, refresh

    async def login(self, email_ou_username: str, password_raw: str) -> Tuple[UsuarioEntity, str, str]:
        # 1. Busca usuário
        usuario = await self.usuario_repo.get_by_email(email_ou_username)
        if not usuario:
            usuario = await self.usuario_repo.get_by_username(email_ou_username)

        if not usuario:
            raise NaoEncontradoException("E-mail ou nome de usuário não cadastrado.")

        # 2. Valida Senha
        if not self.password_hasher.verify(password_raw, usuario.password_hash):
            raise ValidaEntidadeException("Senha incorreta. Tente novamente.")

        # 3. Emite Tokens
        access = self.token_service.create_access_token(usuario.id, usuario.username, usuario.email)
        refresh = self.token_service.create_refresh_token(usuario.id)

        return usuario, access, refresh

    async def refresh(self, refresh_token: str) -> str:
        # 1. Decodifica e valida o tipo do token
        payload = self.token_service.decode_token(refresh_token)
        if payload is None or payload.get("type") != "refresh":
            raise ValidaEntidadeException("Token de refresh inválido ou expirado.")

        usuario_id = int(payload.get("sub"))

        # 2. Busca dados reais
        usuario = await self.usuario_repo.get_by_id(usuario_id)
        if not usuario:
            raise NaoEncontradoException("Usuário não encontrado. Faça login novamente.")

        # 3. Emite novo access
        return self.token_service.create_access_token(usuario.id, usuario.username, usuario.email)
