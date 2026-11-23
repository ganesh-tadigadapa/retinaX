"""Authentication configuration, read from the environment.

Everything that could weaken security is off unless an environment variable turns it on,
and the combinations that would be dangerous in production are rejected at import time
rather than silently accepted. See `_guard()` at the bottom of this file.
"""
from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path

from src.common.config import REPO_ROOT

log = logging.getLogger("dr-auth")

# Load `.env` from the repo root so local secrets (Twilio, AUTH_SECRET) can live in a
# git-ignored file instead of being exported by hand in every shell. Real environment
# variables always win — `override=False` — so a container's injected config is never
# shadowed by a stray file. Optional import: python-dotenv is a dev dependency and is
# deliberately absent from the slim serving image.
try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env", override=False)
except Exception:                                    # noqa: BLE001
    pass

# ------------------------------------------------------------------ environment
# "development" | "production". Anything that is not exactly "production" is treated as
# a non-production environment for FEATURE purposes, but the production guards below are
# written so that a typo'd value can never *enable* a development shortcut.
AUTH_ENV = os.getenv("AUTH_ENV", "development").strip().lower()
IS_PRODUCTION = AUTH_ENV == "production"

# ------------------------------------------------------------------ sign-in (Google)
# The OAuth 2.0 Web client ID from Google Cloud console -> APIs & Services ->
# Credentials. It is PUBLIC (the browser needs the same value as
# NEXT_PUBLIC_GOOGLE_CLIENT_ID); it is used here as the expected `aud` of every ID token,
# which is what stops a token minted for some other app being replayed against ours.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()


def google_enabled() -> bool:
    return bool(GOOGLE_CLIENT_ID)


# ------------------------------------------------------------------ sessions
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(12 * 3600)))

# The signing key for session tokens. In production this
# MUST come from the environment; see _guard(). In development we generate an ephemeral
# one, which means restarting the API invalidates every session — deliberately visible,
# so nobody ships a hardcoded default key by accident.
_env_secret = os.getenv("AUTH_SECRET", "").strip()
AUTH_SECRET = _env_secret or secrets.token_urlsafe(48)
AUTH_SECRET_FROM_ENV = bool(_env_secret)

# ------------------------------------------------------------------ authorisation
# Google account emails that are provisioned as admin (the doctor-verification
# authority) the first time they sign in. This is the bootstrap for "someone has to
# approve the first doctor"; it is an allow-list held by whoever controls the deployment
# environment, not something a signing-up user can influence. Compared lower-cased.
ADMIN_EMAILS = tuple(
    e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
)

# Require a valid session for POST /v1/analyze and GET /v1/scans. On by default: the
# screening pipeline is behind the access-control layer. Set to 0 only for an offline
# pipeline benchmark where no user-facing service is exposed.
def _flag(name: str, default: str = "1") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


PROTECT_ANALYZE = _flag("AUTH_PROTECT_ANALYZE", "1")

# ------------------------------------------------------------------ storage
AUTH_STORE_DIR = Path(os.getenv("AUTH_STORE_DIR", str(REPO_ROOT / "data" / "interim" / "auth")))

# Full per-scan evidence (images, Grad-CAM, rule detail) written next to — but separate
# from — the account records, so a verified doctor can reopen a report. Account data and
# medical data never share a file.
SCAN_EVIDENCE_DIR = Path(
    os.getenv("SCAN_EVIDENCE_DIR", str(REPO_ROOT / "data" / "interim" / "scan_evidence"))
)
STORE_SCAN_EVIDENCE = _flag("STORE_SCAN_EVIDENCE", "1")


def _guard() -> None:
    """Fail loudly rather than run insecurely.

    A production deployment must supply AUTH_SECRET (or session tokens are signed with a
    key that changes on every restart) and GOOGLE_CLIENT_ID (or nobody can sign in).
    """
    if IS_PRODUCTION and not AUTH_SECRET_FROM_ENV:
        raise RuntimeError(
            "AUTH_ENV=production without AUTH_SECRET. Session tokens would be signed "
            "with a key that changes on every restart. Set AUTH_SECRET to a long "
            "random value held in your secret manager.")
    if IS_PRODUCTION and not GOOGLE_CLIENT_ID:
        raise RuntimeError(
            "AUTH_ENV=production without GOOGLE_CLIENT_ID. Sign-in is Google only; "
            "without a client ID nobody can sign in.")
    if not AUTH_SECRET_FROM_ENV:
        log.warning(
            "AUTH_SECRET is not set; using an ephemeral key. Sessions will not survive "
            "an API restart.")
    if not GOOGLE_CLIENT_ID:
        log.warning(
            "GOOGLE_CLIENT_ID is not set; Sign in with Google will refuse every token. "
            "See docs/AUTH.md for the five-minute setup.")


_guard()
