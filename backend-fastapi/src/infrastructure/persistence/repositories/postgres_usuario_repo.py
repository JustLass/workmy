from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.entities.usuario import UsuarioEntity
from src.application.ports.outbound.i_usuario_repository import IUsuarioRepository
from src.infrastructure.persistence.models import UsuarioModel

class PostgresUsuarioRepository(IUsuarioRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_entity(self, model: UsuarioModel) -> UsuarioEntity:
        return UsuarioEntity(
            id=model.id,
            username=model.username,
            email=model.email,
            telefone=model.telefone,
            password_hash=model.password_hash
        )

    async def get_by_id(self, id: int) -> UsuarioEntity | None:
        result = await self.session.execute(select(UsuarioModel).where(UsuarioModel.id == id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_email(self, email: str) -> UsuarioEntity | None:
        result = await self.session.execute(select(UsuarioModel).where(UsuarioModel.email == email))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_username(self, username: str) -> UsuarioEntity | None:
        result = await self.session.execute(select(UsuarioModel).where(UsuarioModel.username == username))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def save(self, usuario: UsuarioEntity) -> UsuarioEntity:
        if usuario.id is None:
            model = UsuarioModel(
                username=usuario.username,
                email=usuario.email,
                telefone=usuario.telefone,
                password_hash=usuario.password_hash
            )
            self.session.add(model)
        else:
            result = await self.session.execute(select(UsuarioModel).where(UsuarioModel.id == usuario.id))
            model = result.scalar_one()
            model.username = usuario.username
            model.email = usuario.email
            model.telefone = usuario.telefone
            model.password_hash = usuario.password_hash

        await self.session.flush() # Flushes changes to get the auto-generated id
        usuario.id = model.id
        return usuario
