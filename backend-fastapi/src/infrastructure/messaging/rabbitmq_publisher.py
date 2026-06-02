"""
RabbitMQ Event Publisher — refatorado como Singleton com conexão persistente (A5).

Problema anterior: cada chamada a `publish()` abria uma nova conexão TCP,
negociava AMQP, declarava exchange e fechava. Isso adicionava ~50-200ms de
latência por evento e esgotava sockets em pico.

Solução: conexão e canal gerenciados pelo lifespan do FastAPI via
`startup()` / `shutdown()`. O publisher é um singleton global.

Uso em main.py:
    from src.infrastructure.messaging.rabbitmq_publisher import publisher
    # No lifespan:
    await publisher.startup()
    yield
    await publisher.shutdown()
"""
import os
import json
import logging
import asyncio
from typing import Optional
import aio_pika
from aio_pika import RobustConnection, RobustChannel, ExchangeType
from src.application.ports.outbound.i_event_publisher import IEventPublisher

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
EXCHANGE_NAME = "workmy_events"
EXCHANGE_TYPE = ExchangeType.TOPIC
_RECONNECT_DELAY_S = 5


class RabbitMQEventPublisher(IEventPublisher):
    """
    Publisher singleton com conexão persistente.

    A conexão AMQP é estabelecida no startup e mantida durante todo o
    ciclo de vida da aplicação. O método `publish()` reutiliza o canal
    existente sem overhead de handshake TCP por evento.

    Em caso de falha de rede, aio-pika RobustConnection reconecta
    automaticamente. O evento é descartado de forma segura (warn no log)
    enquanto reconecta — sem travar a requisição HTTP.
    """

    def __init__(self) -> None:
        self._amqp_url: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        self._connection: Optional[RobustConnection] = None
        self._channel: Optional[RobustChannel] = None
        self._exchange: Optional[aio_pika.Exchange] = None
        self._lock = asyncio.Lock()

    # ── Ciclo de vida ──────────────────────────────────────────────────────

    async def startup(self) -> None:
        """
        Conecta ao RabbitMQ e prepara o canal.
        Deve ser chamado no lifespan de startup do FastAPI.
        Falha silenciosa — a app sobe mesmo sem RabbitMQ (dev sem Docker).
        """
        try:
            self._connection = await aio_pika.connect_robust(
                self._amqp_url,
                reconnect_interval=_RECONNECT_DELAY_S,
            )
            self._channel = await self._connection.channel()
            await self._channel.set_qos(prefetch_count=10)

            self._exchange = await self._channel.declare_exchange(
                EXCHANGE_NAME,
                type=EXCHANGE_TYPE,
                durable=True,
            )
            logger.info(
                f"RabbitMQ: conexão persistente estabelecida com {self._amqp_url} "
                f"(exchange='{EXCHANGE_NAME}')"
            )
        except Exception as exc:
            logger.warning(
                f"RabbitMQ: não foi possível conectar na startup. "
                f"Eventos não serão publicados até que o serviço esteja disponível. "
                f"Detalhe: {exc}"
            )
            self._connection = None
            self._channel = None
            self._exchange = None

    async def shutdown(self) -> None:
        """
        Fecha o canal e a conexão de forma limpa.
        Deve ser chamado no lifespan de shutdown do FastAPI.
        """
        try:
            if self._channel and not self._channel.is_closed:
                await self._channel.close()
            if self._connection and not self._connection.is_closed:
                await self._connection.close()
            logger.info("RabbitMQ: conexão encerrada com sucesso.")
        except Exception as exc:
            logger.warning(f"RabbitMQ: erro ao encerrar conexão: {exc}")
        finally:
            self._connection = None
            self._channel = None
            self._exchange = None

    # ── Publicação ────────────────────────────────────────────────────────

    async def publish(
        self,
        usuario_id: int,
        routing_key: str,
        action: str,
        meta: dict | None = None,
    ) -> None:
        """
        Publica um evento na exchange do RabbitMQ usando o canal persistente.
        Se o RabbitMQ estiver offline ou o canal indisponível, registra
        um warning sem interromper o fluxo HTTP.
        """
        if self._exchange is None:
            logger.warning(
                f"RabbitMQ offline. Evento '{routing_key}.{action}' "
                f"para usuário {usuario_id} descartado (conexão não estabelecida)."
            )
            return

        payload = {
            "usuario_id": usuario_id,
            "action": action,
            "routing_key": routing_key,
            "meta": meta or {},
        }
        message_body = json.dumps(payload).encode("utf-8")

        try:
            await self._exchange.publish(
                aio_pika.Message(
                    body=message_body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=routing_key,
            )
            logger.debug(
                f"RabbitMQ: evento publicado — {routing_key}.{action} "
                f"(usuario_id={usuario_id})"
            )
        except Exception as exc:
            logger.warning(
                f"RabbitMQ: falha ao publicar '{routing_key}.{action}'. "
                f"Detalhe: {exc}"
            )


# ---------------------------------------------------------------------------
# Singleton global — importado pelo main.py e pelos routers.
# ---------------------------------------------------------------------------
publisher = RabbitMQEventPublisher()
