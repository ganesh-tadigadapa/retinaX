"""Sign in with Google: account creation and the doctor verification state machine."""
from __future__ import annotations

from tests.conftest import (TEST_CLIENT_ID, auth_header, email_for, google_credential,
                            signup)

from src.auth import config as cfg
from src.auth import service
from src.auth.storage import LocalAuthStore

USER = "patient.one@gmail.com"
DOC = "dr.rao@gmail.com"


def _google(client, who, **body):
    return client.post("/v1/auth/google",
                       json={"credential": google_credential(who), **body})


# ----------------------------------------------------------------- identity
def test_user_signup_creates_an_active_user_account(client):
    body = signup(client, USER, "user")
    acc = body["account"]
    assert body["created"] is True
    assert acc["role"] == "user"
    assert acc["email"] == USER
    assert acc["mobile"] is None            # WhatsApp number is optional now
    assert acc["doctor_verified"] is False
    assert acc["status"] == "active"
    assert body["next"] == "/screen"


def test_no_password_is_ever_stored(client, auth_store):
    signup(client, USER, "user")
    raw = (auth_store.dir / "accounts.json").read_text().lower()
    for forbidden in ("password", "passwd", "pwd", "hash_pw", "credential"):
        assert forbidden not in raw


def test_a_forged_or_malformed_token_is_refused(client, auth_store):
    r = client.post("/v1/auth/google", json={"credential": "not-a-real-google-token"})
    assert r.status_code == 401
    assert r.json()["detail"]["error"]["code"] == "google_token_invalid"
    assert auth_store.list_accounts() == []


def test_a_token_for_another_app_is_refused(client, auth_store):
    """Audience check: an ID token Google minted for someone else's client ID."""
    r = client.post("/v1/auth/google",
                    json={"credential": google_credential(USER, aud="other-app")})
    assert r.status_code == 401
    assert auth_store.list_accounts() == []


def test_an_unverified_google_email_is_refused(client, auth_store):
    r = client.post("/v1/auth/google",
                    json={"credential": google_credential(USER, verified=False)})
    assert r.status_code == 401
    assert r.json()["detail"]["error"]["code"] == "google_email_unverified"


def test_sign_in_refuses_when_google_is_not_configured(client, monkeypatch):
    monkeypatch.setattr(cfg, "GOOGLE_CLIENT_ID", "")
    r = _google(client, USER)
    assert r.status_code == 503
    assert r.json()["detail"]["error"]["code"] == "google_not_configured"


def test_the_identity_comes_from_the_token_not_the_body(client):
    """Extra identity fields in the body are ignored; the token decides who you are."""
    r = _google(client, USER, email="victim@gmail.com", sub="g-victim")
    assert r.status_code == 200
    assert r.json()["account"]["email"] == USER


def test_login_creates_a_patient_on_first_use_and_returns_it_after(client):
    first = _google(client, USER, intent="login").json()
    assert first["created"] is True and first["account"]["role"] == "user"
    second = _google(client, USER, intent="login").json()
    assert second["created"] is False
    assert second["account"]["account_id"] == first["account"]["account_id"]


def test_one_google_account_is_one_record(client, auth_store):
    signup(client, USER)
    _google(client, USER, intent="signup")
    _google(client, USER, intent="login")
    assert len(auth_store.list_accounts()) == 1


def test_config_endpoint_exposes_only_the_public_client_id(client):
    body = client.get("/v1/auth/config").json()
    assert body == {"providers": ["google"], "google_client_id": TEST_CLIENT_ID}


# ------------------------------------------------------------------- doctors
def test_doctor_signup_is_created_pending_verification(client):
    body = signup(client, DOC, "doctor")
    acc = body["account"]
    assert acc["role"] == "doctor"
    assert acc["doctor_verified"] is False          # the whole point
    assert body["doctor_verification_pending"] is True
    assert body["next"] == "/screen"                # not /reports
    assert acc["doctor_profile"]["registration_number"] == "TN-12345"


def test_doctor_login_without_an_account_points_to_signup(client, auth_store):
    """The Doctor toggle on the LOGIN page cannot create a doctor: that needs the
    registration details the signup form collects."""
    r = _google(client, DOC, intent="login", role="doctor")
    assert r.status_code == 404
    assert r.json()["detail"]["error"]["code"] == "doctor_signup_required"
    assert auth_store.list_accounts() == []


def test_choosing_doctor_cannot_grant_the_privilege(client, auth_store):
    body = signup(client, DOC, "doctor")
    stored = auth_store.get_by_email(DOC)
    assert stored.doctor_verified is False
    assert stored.can_read_reports is False
    r = client.get("/v1/reports", headers=auth_header(body["token"]))
    assert r.status_code == 403


def test_doctor_verified_cannot_be_set_through_the_signup_payload(client, auth_store):
    r = _google(client, DOC, intent="signup", role="doctor",
                doctor_verified=True, can_read_reports=True,
                doctor_profile={"doctor_name": "Dr X", "registration_number": "X-11",
                                "hospital": "Rural PHC"})
    assert r.json()["account"]["doctor_verified"] is False
    assert auth_store.get_by_email(DOC).doctor_verified is False


def test_admin_approval_makes_a_doctor_verified(client, auth_store):
    body = signup(client, DOC, "doctor")
    account_id = body["account"]["account_id"]
    assert client.get("/v1/reports", headers=auth_header(body["token"])).status_code == 403

    service.approve_doctor(account_id, approved=True, by="test", store=auth_store)

    assert auth_store.get(account_id).doctor_verified is True
    # The same token now works: authorisation is re-read from the store per request.
    assert client.get("/v1/reports", headers=auth_header(body["token"])).status_code == 200


def test_approved_doctor_lands_on_reports_at_next_login(client, auth_store):
    body = signup(client, DOC, "doctor")
    service.approve_doctor(body["account"]["account_id"], store=auth_store)
    again = _google(client, DOC, intent="login", role="doctor").json()
    assert again["next"] == "/reports"


def test_approval_can_be_revoked(client, auth_store):
    body = signup(client, DOC, "doctor")
    aid = body["account"]["account_id"]
    service.approve_doctor(aid, approved=True, store=auth_store)
    service.approve_doctor(aid, approved=False, reason="registration not found",
                           store=auth_store)
    assert auth_store.get(aid).doctor_verified is False
    assert client.get("/v1/reports", headers=auth_header(body["token"])).status_code == 403


def test_a_user_account_cannot_be_approved_as_a_doctor(client, auth_store):
    body = signup(client, USER, "user")
    assert service.approve_doctor(body["account"]["account_id"], store=auth_store) is None


def test_admin_emails_are_provisioned_as_admin(tmp_path, monkeypatch):
    monkeypatch.setattr(cfg, "ADMIN_EMAILS", ("boss@gmail.com",))
    store = LocalAuthStore(tmp_path / "auth")
    # even asking for the doctor role, the allow-list wins; case does not matter
    acc = store.create(google_sub="g1", email="Boss@Gmail.com", role="doctor")
    assert acc.role == "admin" and acc.is_admin
    other = store.create(google_sub="g2", email="someone@gmail.com", role="doctor")
    assert other.role == "doctor"


# ---------------------------------------------------------- WhatsApp number
def test_whatsapp_number_can_be_set_and_cleared(client, auth_store):
    body = signup(client, USER)
    h = auth_header(body["token"])
    r = client.put("/v1/auth/me/whatsapp", json={"mobile": "98765 43210"}, headers=h)
    assert r.status_code == 200
    assert r.json()["account"]["mobile"] == "+919876543210"
    assert auth_store.get_by_email(USER).mobile == "+919876543210"

    r = client.put("/v1/auth/me/whatsapp", json={"mobile": None}, headers=h)
    assert r.json()["account"]["mobile"] is None


def test_whatsapp_number_is_validated(client):
    body = signup(client, USER)
    r = client.put("/v1/auth/me/whatsapp", json={"mobile": "123"},
                   headers=auth_header(body["token"]))
    assert r.status_code == 422


def test_whatsapp_number_needs_a_session(client):
    assert client.put("/v1/auth/me/whatsapp",
                      json={"mobile": "9876543210"}).status_code == 401


def test_whatsapp_number_can_be_given_at_signup(client):
    r = _google(client, USER, intent="signup", mobile="9876543210")
    assert r.json()["account"]["mobile"] == "+919876543210"


# ------------------------------------------------------------------ sessions
def test_me_returns_the_stored_role_and_permissions(client):
    body = signup(client, USER, "user")
    me = client.get("/v1/auth/me", headers=auth_header(body["token"])).json()
    assert me["authenticated"] is True
    assert me["account"]["role"] == "user"
    assert me["account"]["email"] == email_for(USER)
    assert me["permissions"]["can_read_reports"] is False
    assert me["permissions"]["can_screen"] is True


def test_me_requires_a_session(client):
    assert client.get("/v1/auth/me").status_code == 401


def test_logout_invalidates_the_token(client):
    body = signup(client, USER, "user")
    h = auth_header(body["token"])
    assert client.get("/v1/auth/me", headers=h).status_code == 200
    assert client.post("/v1/auth/logout", headers=h).status_code == 200
    assert client.get("/v1/auth/me", headers=h).status_code == 401


def test_session_endpoint_is_safe_when_signed_out(client):
    r = client.get("/v1/auth/session")
    assert r.status_code == 200 and r.json()["authenticated"] is False
