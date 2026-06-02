from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, ForeignKey, Boolean, Numeric, DateTime, Date, LargeBinary, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.infrastructure.persistence.session import Base

class UsuarioModel(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    clientes: Mapped[list["ClienteModel"]] = relationship("ClienteModel", back_populates="usuario")
    servicos: Mapped[list["ServicoModel"]] = relationship("ServicoModel", back_populates="usuario")
    projetos: Mapped[list["ProjetoModel"]] = relationship("ProjetoModel", back_populates="usuario")


class ClienteModel(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    empresa: Mapped[str] = mapped_column(String(100), default="Não informada", nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    deletado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    usuario: Mapped["UsuarioModel"] = relationship("UsuarioModel", back_populates="clientes")
    projetos: Mapped[list["ProjetoModel"]] = relationship("ProjetoModel", back_populates="cliente")


class ServicoModel(Base):
    __tablename__ = "servicos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(250), nullable=True)
    ferramentas: Mapped[str | None] = mapped_column(String(250), nullable=True)
    github_repo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    imagem_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    imagem_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    deletado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    usuario: Mapped["UsuarioModel"] = relationship("UsuarioModel", back_populates="servicos")
    projetos: Mapped[list["ProjetoModel"]] = relationship("ProjetoModel", back_populates="servico")


class ProjetoModel(Base):
    __tablename__ = "projetos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    servico_id: Mapped[int] = mapped_column(Integer, ForeignKey("servicos.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DISCOVERY", nullable=False)
    progresso: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    data_entrega: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    mensalista: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    valor_mensal: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    dia_vencimento: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    recorrencia_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    tipo_recorrencia: Mapped[str] = mapped_column(String(20), default="AVULSO", nullable=False)
    recorrencia_ativa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    deletado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    usuario: Mapped["UsuarioModel"] = relationship("UsuarioModel", back_populates="projetos")
    cliente: Mapped["ClienteModel"] = relationship("ClienteModel", back_populates="projetos")
    servico: Mapped["ServicoModel"] = relationship("ServicoModel", back_populates="projetos")
    pagamentos: Mapped[list["PagamentoModel"]] = relationship("PagamentoModel", back_populates="projeto")

    # M1 FIX: UniqueConstraint global removida.
    # A unicidade de contratos ativos é garantida logicamente pelo CriarProjetoUseCase
    # via exists_active_contract() que filtra WHERE deletado_em IS NULL.
    # Uma constraint global impediria recontratação após soft-delete.
    __table_args__ = ()


class PagamentoModel(Base):
    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos.id", ondelete="CASCADE"), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tipo_pagamento: Mapped[str] = mapped_column(String(10), default="MENSAL", nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    observacao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    referencia_mes: Mapped[str | None] = mapped_column(String(7), nullable=True)
    gerado_automaticamente: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    comprovante_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    comprovante_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    deletado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    projeto: Mapped["ProjetoModel"] = relationship("ProjetoModel", back_populates="pagamentos")

    __table_args__ = (
        UniqueConstraint("projeto_id", "referencia_mes", name="uniq_pagamento_projeto_referencia_mes"),
    )
