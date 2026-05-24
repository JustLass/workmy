"""Serialização e auxiliares para o modelo Servico."""
import base64
import re
from typing import Optional, Tuple
from gestao_freelas.models import Servico


def parse_base64_data_url(base64_str: Optional[str]) -> Tuple[Optional[bytes], Optional[str]]:
    """Decodifica uma string Base64 Data URL em bytes e extrai o tipo MIME."""
    if not base64_str:
        return None, None

    # Verifica se está no formato data:image/xxx;base64,...
    match = re.match(r"^data:(?P<mime>image/[a-zA-Z0-9\-\+\.]+);base64,(?P<data>.+)$", base64_str)
    if match:
        mime_type = match.group("mime")
        data_str = match.group("data")
        try:
            image_bytes = base64.b64decode(data_str)
            return image_bytes, mime_type
        except Exception:
            return None, None
    else:
        # Tenta decodificar diretamente caso seja enviado base64 puro
        try:
            cleaned_str = base64_str.strip()
            if "," in cleaned_str:
                cleaned_str = cleaned_str.split(",", 1)[1]
            image_bytes = base64.b64decode(cleaned_str)
            return image_bytes, "image/png"
        except Exception:
            return None, None


def bytes_to_base64_data_url(binary_data: Optional[bytes], mime_type: Optional[str]) -> Optional[str]:
    """Converte dados binários e tipo MIME em uma string Base64 Data URL."""
    if not binary_data:
        return None
    
    # Em Django com SQLite, BinaryField pode vir como bytes ou memoryview
    if isinstance(binary_data, memoryview):
        binary_data = bytes(binary_data)
        
    encoded = base64.b64encode(binary_data).decode("utf-8")
    mime = mime_type or "image/png"
    return f"data:{mime};base64,{encoded}"


def servico_to_dict(servico: Servico) -> dict:
    """Serializa um objeto Servico para dicionário contendo a imagem em Base64."""
    imagem_base64 = bytes_to_base64_data_url(servico.imagem_bytes, servico.imagem_mime)
    return {
        'id': servico.id,
        'nome': servico.nome,
        'descricao': servico.descricao,
        'tags': servico.tags,
        'ferramentas': servico.ferramentas,
        'github_repo': servico.github_repo,
        'imagem_base64': imagem_base64,
        'criado_em': servico.criado_em.isoformat(),
    }
