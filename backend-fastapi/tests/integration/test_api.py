import pytest
import pytest_asyncio
import httpx
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from decimal import Decimal
from datetime import date

from src.presentation.main import app
from src.infrastructure.persistence.session import get_db_session, Base
from src.infrastructure.persistence.models import UsuarioModel, ClienteModel, ServicoModel, ProjetoModel
from src.infrastructure.security.jwt_service import create_access_token

pytestmark = pytest.mark.asyncio

# Configura banco de dados SQLite assíncrono temporário para testes integrados
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
session_maker_test = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

# Override de dependência de sessão de banco para injetar banco de testes
async def override_get_db_session():
    async with session_maker_test() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

app.dependency_overrides[get_db_session] = override_get_db_session


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Recria as tabelas físicas no banco em memória antes de cada teste."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_fastapi_health_check():
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_fastapi_create_projeto_flow():
    # 1. Cria dados fictícios direto no banco de teste usando a sessão
    async with session_maker_test() as session:
        # Cria Usuário
        usuario = UsuarioModel(username="freela1", email="freela@gmail.com", password_hash="hash")
        session.add(usuario)
        await session.flush()
        
        # Cria Cliente
        cliente = ClienteModel(usuario_id=usuario.id, nome="Supermercado Ideal")
        session.add(cliente)
        
        # Cria Serviço
        servico = ServicoModel(usuario_id=usuario.id, nome="Landing Page")
        session.add(servico)
        
        await session.commit()
        
        usuario_id = usuario.id
        cliente_id = cliente.id
        servico_id = servico.id

    # 2. Gera token JWT de teste para o usuário criado
    token = create_access_token(usuario_id, "freela1", "freela@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Faz chamada de POST na rota autenticada da API usando AsyncClient
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "cliente_id": cliente_id,
            "servico_id": servico_id,
            "valor": 2500.00,
            "tipo_recorrencia": "MENSAL",
            "valor_mensal": 500.00,
            "dia_vencimento": 10
        }
        
        response = await client.post("/api/projetos/", json=payload, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 1
        assert data["tipo_recorrencia"] == "MENSAL"
        assert float(data["valor"]) == 2500.00
        assert float(data["valor_mensal"]) == 500.00
        assert data["dia_vencimento"] == 10
        
        # 4. Tenta duplicar para forçar erro 400 de Colisão
        dup_response = await client.post("/api/projetos/", json=payload, headers=headers)
        assert dup_response.status_code == 400
        assert "Este cliente já possui este serviço contratado" in dup_response.json()["detail"]


@pytest.mark.asyncio
async def test_fastapi_auth_register_and_login_flow():
    """Testa de ponta a ponta o fluxo de cadastro, login, refresh e logout do usuário."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Registro Bem-sucedido
        register_payload = {
            "username": "tester123",
            "email": "tester123@example.com",
            "password": "strongpassword123",
            "telefone": "11999999999"
        }
        response = await client.post("/api/auth/register", json=register_payload)
        assert response.status_code == 200
        data = response.json()
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["username"] == "tester123"
        assert data["user"]["email"] == "tester123@example.com"
        refresh_token = data["refresh"]

        # 2. Conflito por Nome de Usuário Duplicado
        dup_user_payload = {
            "username": "tester123",
            "email": "different@example.com",
            "password": "strongpassword123"
        }
        response_dup_user = await client.post("/api/auth/register", json=dup_user_payload)
        assert response_dup_user.status_code == 400
        assert "Nome de usuário já está em uso" in response_dup_user.json()["detail"]

        # 3. Conflito por E-mail Duplicado
        dup_email_payload = {
            "username": "different_user",
            "email": "tester123@example.com",
            "password": "strongpassword123"
        }
        response_dup_email = await client.post("/api/auth/register", json=dup_email_payload)
        assert response_dup_email.status_code == 400
        assert "E-mail já está cadastrado" in response_dup_email.json()["detail"]

        # 4. Login Bem-sucedido
        login_payload = {
            "email": "tester123",  # Testa login via username
            "password": "strongpassword123"
        }
        response_login = await client.post("/api/auth/login", json=login_payload)
        assert response_login.status_code == 200
        login_data = response_login.json()
        assert "access" in login_data
        assert login_data["user"]["email"] == "tester123@example.com"

        # 5. Login Falho (Senha Incorreta)
        bad_login_payload = {
            "email": "tester123",
            "password": "wrongpassword"
        }
        response_bad_login = await client.post("/api/auth/login", json=bad_login_payload)
        assert response_bad_login.status_code == 401
        assert "Senha incorreta" in response_bad_login.json()["detail"]

        # 6. Silent Refresh
        refresh_payload = {
            "refresh": refresh_token
        }
        response_refresh = await client.post("/api/auth/refresh", json=refresh_payload)
        assert response_refresh.status_code == 200
        assert "access" in response_refresh.json()

        # 7. Logout
        logout_headers = {"Authorization": f"Bearer {login_data['access']}"}
        response_logout = await client.post("/api/auth/logout", headers=logout_headers)
        assert response_logout.status_code == 200
        assert "message" in response_logout.json()


@pytest.mark.asyncio
async def test_fastapi_project_list_get_delete_flow():
    """Testa a listagem, detalhe e deleção suave (soft delete) de projetos."""
    # 1. Popula banco com dados fictícios para teste
    async with session_maker_test() as session:
        usuario = UsuarioModel(username="project_tester", email="project_tester@example.com", password_hash="hash")
        session.add(usuario)
        await session.flush()
        
        cliente = ClienteModel(usuario_id=usuario.id, nome="Cliente Teste SA")
        session.add(cliente)
        
        servico = ServicoModel(usuario_id=usuario.id, nome="Desenvolvimento Web")
        session.add(servico)
        
        await session.commit()
        
        usuario_id = usuario.id
        cliente_id = cliente.id
        servico_id = servico.id

    # 2. Cria projeto inicial via API
    token = create_access_token(usuario_id, "project_tester", "project_tester@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Criação do Projeto
        payload = {
            "cliente_id": cliente_id,
            "servico_id": servico_id,
            "valor": 1500.00,
            "tipo_recorrencia": "AVULSO"
        }
        resp_create = await client.post("/api/projetos/", json=payload, headers=headers)
        assert resp_create.status_code == 201
        projeto_id = resp_create.json()["id"]

        # 3. Listagem de Projetos
        resp_list = await client.get("/api/projetos/", headers=headers)
        assert resp_list.status_code == 200
        projetos = resp_list.json()
        assert len(projetos) == 1
        assert projetos[0]["id"] == projeto_id
        assert projetos[0]["cliente_nome"] == "Cliente Teste SA"
        assert projetos[0]["servico_nome"] == "Desenvolvimento Web"

        # 4. Detalhe do Projeto (ID Válido)
        resp_detail = await client.get(f"/api/projetos/{projeto_id}", headers=headers)
        assert resp_detail.status_code == 200
        assert resp_detail.json()["id"] == projeto_id

        # 5. Detalhe do Projeto (ID Inválido)
        resp_detail_invalid = await client.get("/api/projetos/9999", headers=headers)
        assert resp_detail_invalid.status_code == 404

        # 6. Deleção Suave (Soft Delete) do Projeto
        resp_delete = await client.delete(f"/api/projetos/{projeto_id}", headers=headers)
        assert resp_delete.status_code == 200
        assert "sucesso" in resp_delete.json()["message"]

        # 7. Detalhe pós-deleção suave deve retornar 404 pois está deletado logicamente
        resp_detail_post_delete = await client.get(f"/api/projetos/{projeto_id}", headers=headers)
        assert resp_detail_post_delete.status_code == 404

