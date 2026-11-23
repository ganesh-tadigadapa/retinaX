# Authentication and access control

Added as a **separate layer** in front of the existing screening service. The medical
pipeline — quality gate, preprocessing, AI grading, Grad-CAM, classical CV, ICDR rule
engine, escalation, report — is unchanged and unaware of it. `src/api/pipeline.py`
imports nothing from `src/auth/`, and `src/auth/` imports nothing from the pipeline.

---

## 0. Sign in with Google — the only way in

```
browser: Google Identity Services button -> Google account chooser -> ID token (JWT)
browser -> POST /v1/auth/google {credential, intent, role, doctor_profile?, mobile?}
API: verify token (src/auth/google.py) -> find/create account by Google user id -> session
```

Free: Google charges nothing for Sign in with Google, at any number of users. There is
no password, no OTP and no SMS/WhatsApp cost for signing in.

### Setup (about five minutes)

1. <https://console.cloud.google.com> → create (or pick) a project. No billing needed.
2. **APIs & Services → OAuth consent screen** → User type **External** → app name,
   support email, developer email → Save. Scopes: leave the defaults (`openid`, `email`,
   `profile` need no review). While the app is in **Testing**, add the Google accounts
   that may sign in under *Test users* (up to 100); **Publish app** to open it to anyone.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type
   **Web application** → *Authorised JavaScript origins*: `http://localhost:3000`,
   `http://127.0.0.1:3000`, and your deployed frontend origin. No redirect URI is needed
   (the button uses a popup).
4. Copy the **Client ID** (`…apps.googleusercontent.com`) into
   * `.env` → `GOOGLE_CLIENT_ID=…`
   * `web/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…` (optional; without it the page
     asks the API via `GET /v1/auth/config`)
5. `.env` → `ADMIN_EMAILS=you@gmail.com` so you can approve doctors. Restart API and web.

There is **no client secret** in this flow. The client ID is public by design.

### What the API checks

`google-auth` verifies the token's signature against Google's published certificates,
its issuer, its expiry and that its **audience is our client ID** (a token Google minted
for another app is refused). We then require `email_verified`. The email and Google
user id are read from the verified token only — the request body cannot name them.

The account key is Google's stable user id (`google_sub`), not the email, so a renamed
Gmail address stays the same account.

## 1. The WhatsApp number — optional, and not identity

Sign-in no longer uses a phone number. `Account.mobile` survives only as the **WhatsApp
delivery address**, set by the person themselves:

* at signup (optional field), or
* later, from the delivery card on the result page (`PUT /v1/auth/me/whatsapp`).

With no number saved, every WhatsApp send answers `409 no_whatsapp_number` and the UI
offers to add one. The endpoint only ever changes the caller's own record.

**The number is not verified.** Someone could type a number that is not theirs; the
only thing it can receive is *their own* report. Re-adding OTP for this one field
would close that, if it matters for a deployment.

### What was removed

Mobile-number sign-in, the OTP flow (`src/auth/otp.py`, `/v1/auth/otp/request`,
`/v1/auth/sign-in`, `web/components/OtpStep.tsx`, `tests/test_otp.py`) and its
`OTP_*` / `SMS_GATEWAY_*` / `ADMIN_MOBILES` settings.

`TWILIO_*` and `META_WHATSAPP_*` are **kept** — they belong to WhatsApp report
delivery, not to sign-in.

---

## 2. Two account types, and why choosing "Doctor" grants nothing

At signup the person chooses **User Account** or **Doctor Account**. A doctor signup
collects verification information (name, medical registration number, hospital) and
creates an account with:

```
role             = doctor
doctor_verified  = false        <- always, for every doctor, at creation
```

`doctor_verified` is written in exactly one place — `LocalAuthStore.set_doctor_verified`,
reached only through `service.approve_doctor()`. Nothing in the signup path can call it.
The two routes into it are:

| Route | Who can use it |
|---|---|
| `POST /v1/auth/admin/doctors/{id}/verify` | an account whose stored role is `admin` |
| `scripts/approve_doctor.py` | whoever has write access to the server's account store |

Admin accounts come from `ADMIN_EMAILS`, an allow-list held in the deployment
environment. A signup form cannot request the admin role: `LocalAuthStore.create`
coerces anything that is not `user` or `doctor` down to `user`.

There is **no bypass flag and no "dev doctor" number.** The local approval script is not
a backdoor because running it means you already control the server's filesystem; it
exposes no network surface and accepts no token.

Note the asymmetry this creates, and it is the right one: signing in is now free, but
becoming a *doctor* still requires an administrator. Removing verification lowered the
bar to holding an account; it did not lower the bar to holding a privilege.

### For production

Replace the script with a real verification workflow — a reviewer UI on top of the admin
endpoint, an NMC registry lookup, an audit record of who approved whom. Because every
path already funnels through `service.approve_doctor()`, that swap touches one function.

---

## 2b. Who may read a patient's data

Authentication answers *who you are*. This answers *what you may open*, and it is a
separate decision enforced separately on every request.

**A patient reads their own record by OWNERSHIP, not by role.** Every patient endpoint
resolves the record and compares its `account_id` against the caller's. There is no
patient-facing endpoint anywhere that accepts an account id, so there is nothing to
forge: the only id a patient can supply names a screening, and a screening that is not
theirs answers `404`.

**A doctor needs BOTH halves:**

```
verified doctor role      (the programme's half — an administrator grants it)
+ active care relationship (the patient's half — the patient grants it)
```

Either alone is refused. A verified doctor with no relationship sees an **empty** report
list, and `404` on any scan. This is a change: the report collection used to serve every
scan in the system to any verified doctor. The records carried no name, but they were
still an identifiable person's clinical results, and *"a doctor"* is not the same claim
as *"this patient's doctor"*.

There is **no endpoint that lists every patient.** `GET /v1/passport/patients` is the
only patient listing and it is scoped to the caller's own grants.

### How a relationship is created, and ended

| Created by | Endpoint |
|---|---|
| the patient sharing a code | `POST /v1/passport/sharing/codes` → `POST /v1/passport/sharing/redeem` |
| an administrator assigning | `POST /v1/passport/access` |
| a doctor who already has access recording a review | `POST /v1/reports/{scan_id}/review` |
| **ended by the patient, at any time** | `POST /v1/passport/sharing/{doctor_id}/revoke` |

The share code is a capability and is treated like one: 8 characters from an unambiguous
alphabet (no `O`/`0`, no `I`/`1`/`L`, because it is read aloud across a desk), **stored
only as an HMAC**, single use, and expiring in `PASSPORT_SHARE_CODE_TTL_SECONDS` (default
30 minutes). The plaintext is returned once, to its owner, and can never be re-displayed.

Revocation is effective on the **very next request**: `has_access` re-reads the grant from
disk on every call, so there is no cached authorisation and no session to wait out. The
row is marked `revoked` rather than deleted, because *"who could see my record, and until
when?"* is a question a patient is entitled to an answer to.

`404` rather than `403` throughout, so these endpoints cannot be used as an oracle for
discovering that a scan id or an account id exists.

### Ownership lives outside the medical record

`/v1/analyze` deliberately does **not** write the caller onto the scan — a screening
result must not depend on who uploaded the image. Ownership is recorded separately, in
the passport layer (`account_id` on the passport row) and in the delivery layer
(`account_id` on the report metadata). `src/api/reports.py::_owner_of` resolves it from
there, and fails closed: an unknown scan, an unowned scan or a lookup error all answer
"not authorised".


---

## 3. Sign-in, end to end

```
POST /v1/auth/google   {"credential": "<Google ID token>", "intent": "login"|"signup",
                        "role": "user"|"doctor", "doctor_profile": {...}, "mobile": "+91..."?}
```

`src/auth/service.py::sign_in`:

| Situation | Result |
|---|---|
| Existing Google account | signed in with its **stored** role; the toggle is ignored |
| New account, Patient (login or signup) | patient account created |
| New account, Doctor, **signup** | doctor account created, `doctor_verified=false` |
| New account, Doctor, **login** | `404 doctor_signup_required` — the UI links to doctor signup, which collects the registration details |
| Suspended account | `403 account_suspended` |

`role` is a REQUEST, never a grant: `storage.create` coerces anything but user/doctor
down to user, admin comes only from `ADMIN_EMAILS`, and every doctor is created
unverified. See §2. The response shape (`token`, `account`, `next`,
`doctor_verification_pending`) is unchanged, so `Guard`, the role system and every
protected endpoint are untouched.

---

## 5. Sessions and roles

A session token is a JWT-shaped HMAC-SHA256 blob built from the standard library, so no
new dependency lands in the serving image:

```
base64url({"sub": "<account id>", "jti": "...", "iat": ..., "exp": ...}).<signature>
```

**The token does not carry the role.** Every protected request re-reads the account from
the store and asks it: `role`, `doctor_verified`, `status`. Consequences:

* a client cannot grant itself a role by editing a token — it is signed;
* a client cannot grant itself a role through a header, a body field or a query
  parameter — none are consulted;
* approving or revoking a doctor takes effect on their **next request**, not whenever
  their token happens to expire.

`POST /v1/auth/logout` adds the token's `jti` to a revocation list kept until the token
would have expired anyway.

### Authorisation matrix

| | screen | own results | `/v1/scans` | `/v1/reports` | approve doctors |
|---|---|---|---|---|---|
| anonymous | ✗ | ✗ | ✗ | ✗ | ✗ |
| user | ✓ | ✓ | ✓ | ✗ `doctor_access_required` | ✗ |
| doctor, unverified | ✓ | ✓ | ✓ | ✗ `doctor_verification_pending` | ✗ |
| doctor, verified | ✓ | ✓ | ✓ | ✓ | ✗ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |

The two doctor refusals are distinct error codes because the UI has to say two different
things: "Doctor access required." versus "Doctor verification pending."

---

## 6. Report anonymisation

`GET /v1/reports` and `GET /v1/reports/{scan_id}` build their responses **field by
field**. There is no `**record` anywhere in `src/api/reports.py`, so a field added to the
scan record later cannot appear in a doctor's view unless someone edits that file
deliberately.

The field this matters most for is `patient_ref`. The v1 contract says it is free text
with "no PII enforced by us", which in the field means it will sometimes hold a name or a
phone number. It is therefore **never returned by any endpoint in this module**, and
`tests/test_reports_privacy.py` asserts that against a record that deliberately contains
both.

A report is identified by its **scan id** — generated by the pipeline from a random UUID,
with no relationship to any patient identity. The doctor sees a queue of scans, not a
directory of people.

`GET /v1/scans` (the in-session review queue, which predates this work) now requires a
session and has `patient_ref` stripped from its payload. The review UI never displayed
that field.

---

## 7. The medical data model stays separated

Five things are kept as separate facts about one scan:

```
AI prediction          what the model output at screening time
Clinical evidence      quality checks, lesion counts, Grad-CAM
Rule-engine opinion    the ICDR rules run independently of the CNN
Screening recommendation   referral + escalation
Clinician review       what a doctor later said about it
```

A clinician review is written to an **append-only ledger** in a different file
(`data/interim/clinician_reviews.json`). It never touches the scan record, so the AI
grade, the rule grade and the referral decision after a review are byte-identical to what
they were before it — pinned by `test_the_ai_prediction_is_unchanged_by_a_review`. The
full review history is kept and shown, which is the point: you can always answer "what
did the model say, what did the human say, and when?"

---

## 8. Storage

| File | Holds |
|---|---|
| `data/interim/auth/accounts.json` | account id, Google user id, email, name, picture URL, optional WhatsApp number, role, `doctor_verified`, status, created/last-login timestamps, and for doctors the claimed credentials |
| `data/interim/auth/revoked_sessions.json` | logged-out token ids until their natural expiry |
| `data/interim/scans.json` | the existing scan summaries (unchanged) |
| `data/interim/scan_evidence/{scan_id}.json` | full evidence per scan, so a doctor can reopen it |
| `data/interim/clinician_reviews.json` | the append-only review ledger |

No password field exists. No retinal image is stored in an account record. Account data
and medical data never share a file.

---

## 9. Environment variables

See `.env.example` at the repo root for the annotated list.

**Backend** (`.env`, git-ignored) — never sent to the browser:

| Variable | Meaning |
|---|---|
| `AUTH_SECRET` | signs session tokens, Eye Health Passport share codes and the short-lived report media URLs. **Required in production**; the API refuses to start without it |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID; the expected `aud` of every Google ID token. **Required in production**; the API refuses to start without it |
| `ADMIN_EMAILS` | comma-separated Google emails provisioned as `admin` on first sign-in. The bootstrap for "someone has to approve the first doctor" |
| `AUTH_PROTECT_ANALYZE` | whether `/v1/analyze` needs a session. On by default |

**Removed with Google sign-in:** every `OTP_*`, every `SMS_GATEWAY_*`, and
`ADMIN_MOBILES`.

**Deliberately kept:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`TWILIO_WHATSAPP_FROM` are the WhatsApp delivery provider's credentials, not sign-in's
(`src/delivery/providers/twilio.py`). Deleting them would have broken report delivery.

**Frontend** (`web/.env.local`) — `NEXT_PUBLIC_API_BASE` and, optionally,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` (public by design). Anything prefixed `NEXT_PUBLIC_` is
compiled into the JavaScript bundle and readable by every visitor, so no secret of any
kind belongs there.
Next.js reads `web/.env.local` at server **start**; restart `make web` after editing it.

---

## 10. Production limitations

Honest list. None of these are hidden by the prototype.

1. **The session token is kept in `localStorage`**, which is readable by any XSS on the
   origin. The API also sets an `HttpOnly` cookie, which is the safer transport, but the
   bearer token is what makes the split-origin deployment (Vercel frontend, Cloud Run
   API) work. A single-origin deployment should use the cookie and drop the bearer.
2. **Storage is JSON files with a process-level lock.** It does not survive concurrent
   API instances, and Cloud Run will run several. Accounts belong in Firestore or
   Postgres before any real traffic; `LocalAuthStore` is deliberately a small interface
   so that swap is contained.
3. **No rate limiting on sign-in.** Google does the credential check, but the API still
   accepts any number of token submissions. Put a real rate limiter (API gateway, Redis)
   in front.
4. **Doctor verification is a human decision recorded by hand.** There is no registry
   lookup, no document upload, no proof of identity.
5. **The WhatsApp number is unverified.** See §1.
6. **No self-service account deletion** (only `scripts/manage_account.py`), and no consent record —
   all of which a real deployment handling patient data needs under the DPDP Act.
7. **The evidence store keeps retinal images on local disk unencrypted.** Fine for a
   demo; a deployment needs encryption at rest, a retention policy, and a lawful basis
   for keeping them at all.
8. **No audit log of report *reads*.** Reviews are audited; who looked at what is not.
