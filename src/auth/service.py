"""Sign-in use-cases: open a session, log out, approve a doctor.

This layer owns the decisions; `routes.py` owns only HTTP. Keeping them apart is what
lets the tests exercise the rules without a web server, and what keeps the medical
pipeline free of any account code.

HOW IDENTITY IS PROVED
----------------------
Sign in with Google. The route hands this module a `GoogleIdentity` that
`src/auth/google.py` has already verified (signature, issuer, expiry, audience, verified
email). The account is keyed by Google's stable user id, so changing the Gmail display
name or even the address does not fork the person into a second record.

The WhatsApp number is NOT identity any more. It is an optional delivery address the
person sets for themselves and nothing verifies it.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from src.auth.google import GoogleIdentity
from src.auth.models import Account, Role
from src.auth.security import mint_token
from src.auth.storage import LocalAuthStore, get_auth_store

log = logging.getLogger("dr-auth.service")


@dataclass
class VerifyOutcome:
    ok: bool
    error: str | None = None
    message: str = ""
    account: Account | None = None
    token: str | None = None
    expires_at: float = 0.0
    created: bool = False
    attempts_remaining: int = 0


_HUMAN = {
    "account_suspended": ("This account is not active. "
                          "Contact the programme administrator."),
    "doctor_signup_required": ("No doctor account exists for this Google account yet. "
                               "Create a doctor account first."),
}


def sign_in(identity: GoogleIdentity, *, intent: str = "login",
            role: str = Role.USER.value, doctor_profile: dict | None = None,
            mobile: str | None = None,
            store: LocalAuthStore | None = None) -> VerifyOutcome:
    """Open a session for a verified Google identity, creating the account if needed.

    * Existing account: signed in with the role it already has. Asking for "doctor" again
      changes nothing, which is what stops a browser upgrading itself by replaying
      signup. Name/email/picture are refreshed from Google.
    * New account, patient: created on first sign-in from either page.
    * New account, doctor: created only from SIGNUP (which collects the registration
      details), and always unverified. A doctor-toggle LOGIN with no account is refused
      with `doctor_signup_required` so the person lands on the right form.

    The only refusal for an existing account is SUSPENDED, an administrator's decision.
    """
    store = store or get_auth_store()
    account = store.get_by_google_sub(identity.sub)
    created = False

    if account is None:
        if role == Role.DOCTOR.value and intent != "signup":
            return VerifyOutcome(False, "doctor_signup_required",
                                 _HUMAN["doctor_signup_required"])
        requested_role = role if intent == "signup" else Role.USER.value
        profile = doctor_profile if requested_role == Role.DOCTOR.value else None
        account = store.create(google_sub=identity.sub, email=identity.email,
                               name=identity.name, picture=identity.picture,
                               mobile=mobile, role=requested_role,
                               doctor_profile=profile)
        created = True
        log.info("account created %s role=%s doctor_verified=%s",
                 account.account_id, account.role, account.doctor_verified)
    else:
        changes = {k: v for k, v in (("email", identity.email), ("name", identity.name),
                                     ("picture", identity.picture))
                   if v and getattr(account, k) != v}
        if changes:
            account = store.update(account.account_id, **changes) or account

    if account.status != "active":
        return VerifyOutcome(False, "account_suspended", _HUMAN["account_suspended"])

    store.touch_login(account.account_id)
    account = store.get(account.account_id) or account
    session = mint_token(account.account_id)
    log.info("sign-in account=%s created=%s", account.account_id, created)
    return VerifyOutcome(True, account=account, token=session.token,
                         expires_at=session.expires_at, created=created,
                         message="Signed in.")


def set_whatsapp_number(account_id: str, mobile: str | None, *,
                        store: LocalAuthStore | None = None) -> Account | None:
    """The caller's own delivery number. Normalised by the request model; None clears."""
    return (store or get_auth_store()).update(account_id, mobile=mobile)


def logout(jti: str, expires_at: float, *, store: LocalAuthStore | None = None) -> None:
    (store or get_auth_store()).revoke(jti, expires_at)


def approve_doctor(account_id: str, *, approved: bool = True, by: str = "admin",
                   reason: str | None = None,
                   store: LocalAuthStore | None = None) -> Account | None:
    """The doctor-verification decision, in one function.

    Every route into doctor privileges goes through here: the admin API endpoint and the
    local approval script. There is no other writer of `doctor_verified`, which is what
    makes "a person cannot gain doctor privileges by choosing Doctor" true rather than
    merely intended.
    """
    store = store or get_auth_store()
    acc = store.set_doctor_verified(account_id, approved, by=by, reason=reason)
    if acc:
        log.info("doctor %s %s by %s", account_id,
                 "approved" if approved else "revoked", by)
    return acc


def pending_doctors(store: LocalAuthStore | None = None) -> list[Account]:
    store = store or get_auth_store()
    return [a for a in store.list_accounts(Role.DOCTOR.value) if not a.doctor_verified]
