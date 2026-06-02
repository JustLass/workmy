from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.entities.servico import ServicoEntity
from src.application.ports.outbound.i_servico_repository import IServicoRepository
from src.infrastructure.persistence.models import ServicoModel

class PostgresServicoRepository(IServicoRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_entity(self, model: ServicoModel) -> ServicoEntity:
        return ServicoEntity(
            id=model.id,
            usuario_id=model.usuario_id,
            nome=model.nome,
            descricao=model.descricao,
            tags=model.tags,
            ferramentas=model.ferramentas,
            github_repo=model.github_repo,
            imagem_bytes=model.imagem_bytes,
            imagem_mime=model.imagem_mime,
            criado_em=model.criado_em,
            deletado_em=model.deletado_em
        )

    async def get_by_id(self, id: int, usuario_id: int) -> ServicoEntity | None:
        result = await self.session.execute(
            select(ServicoModel).where(
                ServicoModel.id == id,
                ServicoModel.usuario_id == usuario_id,
                ServicoModel.deletado_em.is_(None)
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_usuario(self, usuario_id: int) -> list[ServicoEntity]:
        result = await self.session.execute(
            select(ServicoModel).where(
                ServicoModel.usuario_id == usuario_id,
                ServicoModel.deletado_em.is_(None)
            ).order_by(ServicoModel.criado_em.desc())
        )
        models = result.scalars().all()
        return [self._to_entity(m) for m in models]

    async def save(self, servico: ServicoEntity) -> ServicoEntity:
        if servico.id is None:
            model = ServicoModel(
                usuario_id=servico.usuario_id,
                nome=servico.nome,
                descricao=servico.descricao,
                tags=servico.tags,
                ferramentas=servico.ferramentas,
                github_repo=servico.github_repo,
                imagem_bytes=servico.imagem_bytes,
                imagem_mime=servico.imagem_mime,
                deletado_em=servico.deletado_em
            )
            self.session.add(model)
        else:
            result = await self.session.execute(
                select(ServicoModel).where(
                    ServicoModel.id == servico.id,
                    ServicoModel.usuario_id == servico.usuario_id
                )
            )
            model = result.scalar_one()
            model.nome = servico.nome
            model.descricao = servico.descricao
            model.tags = servico.tags
            model.ferramentas = servico.ferramentas
            model.github_repo = servico.github_repo
            model.imagem_bytes = servico.imagem_bytes
            model.imagem_mime = servico.imagem_mime
            model.deletado_em = servico.deletado_em

        await self.session.flush()
        servico.id = model.id
        servico.criado_em = model.criado_em
        return servico

    async def exists_by_id(self, id: int, usuario_id: int) -> bool:
        result = await self.session.execute(
            select(ServicoModel.id).where(
                ServicoModel.id == id,
                ServicoModel.usuario_id == usuario_id,
                ServicoModel.deletado_em.is_(None)
            )
        )
        return result.scalar_one_or_none() is not None

    async def count_projetos_ativos(self, servico_id: int, usuario_id: int) -> int:
        from src.infrastructure.persistence.models import ProjetoModel
        from sqlalchemy import func
        result = await self.session.execute(
            select(func.count(ProjetoModel.id))
            .where(
                ProjetoModel.servico_id == servico_id,
                ProjetoModel.usuario_id == usuario_id,
                ProjetoModel.deletado_em.is_(None),
            )
        )
        return result.scalar() or 0

    async def exists_by_name(self, nome: str, usuario_id: int, exclude_id: int | None = None) -> bool:
        stmt = select(ServicoModel.id).where(
            ServicoModel.nome == nome,
            ServicoModel.usuario_id == usuario_id,
            ServicoModel.deletado_em.is_(None)
        )
        if exclude_id is not None:
            stmt = stmt.where(ServicoModel.id != exclude_id)
            
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None
