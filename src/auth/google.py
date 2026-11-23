"""Sign in with Google: turn a Google ID token into a verified identity.

The browser gets an ID token (a JWT signed by Google) from Google Identity Services and
sends it to POST /v1/auth/google. This module is the only place that token is trusted,
and it trusts it only after `google-auth` has checked:

  * the signature, against Google's published certificates (fetched and cached),
  * the issuer is accounts.google.com,
  * the token has not expired,
  * the audience is OUR client ID — so a token minted for another app is refused,

and after this module has checked that Google says the email is verified.

Identity is read from the token and nowhere else. A request body cannot name an email.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from src.auth import config as cfg

log = logging.getLogger("dr-auth.google")

_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str            # Google's stable, never-reused user id
    email: str          # lower-cased
    name: str = ""
    picture: str = ""


class GoogleAuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _verify_token(credential: str, client_id: str) -> dict:
    """Signature/issuer/expiry/audience check. Returns the claims or raises ValueError.

    Kept as its own function so the test suite can replace it without the network.
    """
    from google.auth.transport import requests as g_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, g_requests.Request(), client_id)


def verify_credential(credential: str) -> GoogleIdentity:
    if not cfg.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("google_not_configured",
                              "Sign in with Google is not configured on this server.")
    try:
        claims = _verify_token(credential, cfg.GOOGLE_CLIENT_ID)
    except ValueError as e:
        # Bad signature, wrong audience, expired, malformed — all one answer to the
        # client. The detail goes to the log for the operator.
        log.info("google token refused: %s", e)
        raise GoogleAuthError("google_token_invalid",
                              "Google sign-in could not be verified. Try again.") from e
    except Exception as e:                           # noqa: BLE001
        # Most likely: Google's certificate endpoint unreachable.
        log.warning("google token verification failed: %s", e)
        raise GoogleAuthError("google_unavailable",
                              "Could not reach Google to verify sign-in. Try again.") from e

    if claims.get("iss") not in _ISSUERS:
        raise GoogleAuthError("google_token_invalid",
                              "Google sign-in could not be verified. Try again.")
    sub = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise GoogleAuthError("google_token_invalid",
                              "Google did not return an email for this account.")
    if not claims.get("email_verified"):
        raise GoogleAuthError("google_email_unverified",
                              "This Google account's email is not verified.")
    return GoogleIdentity(sub=sub, email=email,
                          name=str(claims.get("name") or ""),
                          picture=str(claims.get("picture") or ""))
