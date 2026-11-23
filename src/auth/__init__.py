"""Access-control layer for the DR screening service.

Deliberately self-contained: the medical pipeline (`src/api/pipeline.py`, `src/grading`,
`src/quality`, `src/segment`, `src/explain`) imports nothing from here, and nothing here
imports from them. Authentication decides WHO may call the service; it has no opinion
about what the service computes.

Layout
    config.py    environment-driven settings, with production guards
    models.py    Account, Role, request/response shapes
    google.py    verifies a Google ID token -> GoogleIdentity
    security.py  session tokens + the FastAPI authorisation dependencies
    service.py   the use-cases (sign in, WhatsApp number, logout, approve doctor)
    storage.py   account / revocation persistence
    routes.py    the /v1/auth HTTP surface
"""
from src.auth.models import Account, Role            # noqa: F401
