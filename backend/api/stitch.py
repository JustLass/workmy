import os
import json
import urllib.request
from typing import Optional
from pathlib import Path
from ninja import Router
from api.auth import AuthBearer
from api.schemas import ErrorSchema

router = Router(tags=["Stitch MCP Integration"], auth=AuthBearer())


def obter_config_stitch() -> tuple[Optional[str], Optional[str]]:
    """Busca a URL e a chave do Stitch configuradas no mcp_config.json do usuário"""
    
    # 1. Tentar variável de ambiente
    config_path_env = os.environ.get('STITCH_MCP_CONFIG_PATH')
    if config_path_env and os.path.exists(config_path_env):
        try:
            with open(config_path_env, "r", encoding="utf-8") as f:
                data = json.load(f)
                stitch_cfg = data.get("mcpServers", {}).get("stitch", {})
                url = stitch_cfg.get("serverUrl")
                api_key = stitch_cfg.get("headers", {}).get("X-Goog-Api-Key")
                if url and api_key:
                    return url, api_key
        except Exception as e:
            print(f"Erro ao ler STITCH_MCP_CONFIG_PATH: {e}")
    
    # 2. Tentar caminhos padrão no home do usuário
    home = Path.home()
    paths = [
        home / ".gemini" / "antigravity-ide" / "mcp_config.json",
        home / ".gemini" / "antigravity" / "mcp_config.json",
        home / ".config" / "stitch" / "mcp_config.json",  # Linux/Mac
    ]
    
    for path in paths:
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    stitch_cfg = data.get("mcpServers", {}).get("stitch", {})
                    url = stitch_cfg.get("serverUrl")
                    api_key = stitch_cfg.get("headers", {}).get("X-Goog-Api-Key")
                    if url and api_key:
                        return url, api_key
            except Exception as e:
                print(f"Erro ao ler {path}: {e}")
    
    return None, None


def chamar_mcp_stitch(method: str, params: dict) -> dict:
    """Realiza uma chamada JSON-RPC para o servidor MCP do Stitch"""
    url, api_key = obter_config_stitch()
    if not url or not api_key:
        raise ValueError(
            "Configuração do servidor MCP do Stitch não encontrada. "
            "Configure STITCH_MCP_CONFIG_PATH na variável de ambiente ou "
            "coloque mcp_config.json em ~/.gemini/antigravity/"
        )

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }
    
    headers = {
        "X-Goog-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=30) as response:
        res = response.read().decode("utf-8")
        return json.loads(res)


@router.get("/projects", summary="Listar todos os projetos do Google Stitch")
def list_stitch_projects(request):
    try:
        res = chamar_mcp_stitch("tools/call", {
            "name": "list_projects",
            "arguments": {}
        })
        if "result" in res and "content" in res["result"]:
            content_text = res["result"]["content"][0].get("text", "{}")
            return json.loads(content_text)
        return res
    except Exception as e:
        return 500, {"detail": str(e)}


@router.get("/projects/{project_id}/screens", summary="Listar todas as telas de um projeto do Stitch")
def list_stitch_screens(request, project_id: str):
    try:
        res = chamar_mcp_stitch("tools/call", {
            "name": "list_screens",
            "arguments": {
                "projectId": project_id
            }
        })
        if "result" in res and "content" in res["result"]:
            content_text = res["result"]["content"][0].get("text", "{}")
            return json.loads(content_text)
        return res
    except Exception as e:
        return 500, {"detail": str(e)}
