"""Account and session persistence.

Same shape as `src/api/store.py` (local JSON, process-lock, swappable), but a SEPARATE
set of files on purpose: account data and medical scan data must not live in the same
record or the same document. Nothing in this module ever touches a retinal image.

What is stored per account: id, Google user id, email, display name, picture URL, an
optional WhatsApp number, role, created timestamp, doctor_verified, status, and — for
doctors only — the claimed verification details.

There is no password field, because there is no password: identity is a verified Google
ID token (src/auth/google.py).
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from src.auth import config as cfg
from src.auth.models import Account, AccountStatus, Role

_LOCK = threading.RLock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class _JsonFile:
    """One JSON document on disk, read and written under a process-wide lock."""

    def __init__(self, path: Path, empty):
        self.path = path
        self._empty = empty
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text(json.dumps(empty))

    def read(self):
        try:
            return json.loads(self.path.read_text())
        except Exception:                            # noqa: BLE001
            return json.loads(json.dumps(self._empty))

    def write(self, data) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        # os.replace is atomic on POSIX: a crash mid-write cannot leave a half-file that
        # would lock every account out on the next read.
        os.replace(tmp, self.path)


class LocalAuthStore:
    """Prototype account store. Good enough for a screening demo; not a database.

    Deliberately small surface: the rest of the auth code only calls these methods, so
    swapping in Firestore/Postgres later means implementing this interface and nothing
    else.
    """

    def __init__(self, directory: Path | None = None):
        d = Path(directory or cfg.AUTH_STORE_DIR)
        self._accounts = _JsonFile(d / "accounts.json", [])
        self._revoked = _JsonFile(d / "revoked_sessions.json", [])
        self.dir = d

    # ------------------------------------------------------------- accounts
    def get_by_google_sub(self, sub: str) -> Account | None:
        for rec in self._accounts.read():
            if sub and rec.get("google_sub") == sub:
                return Account.from_record(rec)
        return None

    def get_by_email(self, email: str) -> Account | None:
        email = (email or "").strip().lower()
        for rec in self._accounts.read():
            if email and (rec.get("email") or "").lower() == email:
                return Account.from_record(rec)
        return None

    def get(self, account_id: str) -> Account | None:
        for rec in self._accounts.read():
            if rec.get("account_id") == account_id:
                return Account.from_record(rec)
        return None

    def create(self, *, google_sub: str, email: str, role: str, name: str = "",
               picture: str = "", mobile: str | None = None,
               doctor_profile: dict | None = None) -> Account:
        """Creates an account. A doctor is ALWAYS created unverified.

        The `role` argument comes, ultimately, from a signup form — which is why the one
        thing it cannot do is set doctor_verified. Admin is not reachable from a form at
        all: it comes from the ADMIN_EMAILS allow-list held in the environment.
        """
        email = (email or "").strip().lower()
        with _LOCK:
            existing = self.get_by_google_sub(google_sub)
            if existing:
                # The duplicate-account guard: one Google account is one record,
                # whichever flow arrives.
                return existing
            if email in cfg.ADMIN_EMAILS:
                role = Role.ADMIN.value
            elif role not in (Role.USER.value, Role.DOCTOR.value):
                role = Role.USER.value
            acc = Account(
                account_id="acc_" + uuid.uuid4().hex[:16],
                google_sub=google_sub,
                email=email,
                name=name,
                picture=picture,
                mobile=mobile,
                role=role,
                doctor_verified=False,          # never true at creation, for any role
                status=AccountStatus.ACTIVE.value,
                created_at=_now(),
                doctor_profile=doctor_profile if role == Role.DOCTOR.value else None,
            )
            rows = self._accounts.read()
            rows.append(acc.to_record())
            self._accounts.write(rows)
            return acc

    def delete(self, account_id: str) -> bool:
        with _LOCK:
            rows = self._accounts.read()
            kept = [r for r in rows if r.get("account_id") != account_id]
            if len(kept) == len(rows):
                return False
            self._accounts.write(kept)
            return True

    def update(self, account_id: str, **changes) -> Account | None:
        with _LOCK:
            rows = self._accounts.read()
            for rec in rows:
                if rec.get("account_id") == account_id:
                    rec.update(changes)
                    self._accounts.write(rows)
                    return Account.from_record(rec)
            return None

    def touch_login(self, account_id: str) -> None:
        self.update(account_id, last_login_at=_now())

    def list_accounts(self, role: str | None = None) -> list[Account]:
        rows = [Account.from_record(r) for r in self._accounts.read()]
        return [a for a in rows if role is None or a.role == role]

    def set_doctor_verified(self, account_id: str, verified: bool, *,
                            by: str = "admin", reason: str | None = None) -> Account | None:
        """The ONLY way doctor privileges are granted. Called by the admin endpoint and
        by scripts/approve_doctor.py — both of which require credentials the signing-up
        person does not have."""
        with _LOCK:
            acc = self.get(account_id)
            if acc is None or acc.role != Role.DOCTOR.value:
                return None
            profile = dict(acc.doctor_profile or {})
            profile["verified_at"] = _now() if verified else None
            profile["verified_by"] = by if verified else None
            profile["rejection_reason"] = None if verified else reason
            return self.update(account_id, doctor_verified=bool(verified),
                               doctor_profile=profile)

    # -------------------------------------------------------------- sessions
    def revoke(self, jti: str, expires_at: float) -> None:
        """Logout. Kept until the token would have expired anyway, then discarded."""
        with _LOCK:
            rows = [r for r in self._revoked.read()
                    if r.get("expires_at", 0) > datetime.now(timezone.utc).timestamp()]
            rows.append({"jti": jti, "expires_at": expires_at})
            self._revoked.write(rows)

    def is_revoked(self, jti: str) -> bool:
        return any(r.get("jti") == jti for r in self._revoked.read())


_STORE: LocalAuthStore | None = None


def get_auth_store() -> LocalAuthStore:
    global _STORE
    if _STORE is None:
        _STORE = LocalAuthStore()
    return _STORE


def set_auth_store(store: LocalAuthStore | None) -> None:
    """Test seam. Lets the suite point the whole auth layer at a tmp directory."""
    global _STORE
    _STORE = store
