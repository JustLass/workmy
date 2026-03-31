"""
Endpoints públicos de saúde/keep-alive.
"""
from django.db import connection
from ninja import Router

router = Router(tags=["Health"])


@router.get("/ping", summary="Health check com ping no banco")
def ping(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return {"status": "ok"}
