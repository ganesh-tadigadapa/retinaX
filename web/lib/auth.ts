// Client-side session handling: Sign in with Google -> application session.
//
// The token is minted by the backend and carries an account id only — the role that
// decides what a doctor may see is read from the server's account store on every
// request. Nothing in this file grants a permission; it reflects what /v1/auth/me says.
// Editing anything here (or in devtools) changes what the UI *draws*, never what the API
// *returns*.
import { API_BASE } from "@/lib/api";

const TOKEN_KEY = "dr_session_token";

export type Account = {
  account_id: string;
  email: string;
  name: string;
  picture: string;
  /** Optional WhatsApp delivery number. Not a login credential. */
  mobile: string | null;
  mobile_masked: string | null;
  role: "user" | "doctor" | "admin";
  doctor_verified: boolean;
  status: string;
  created_at: string;
  can_read_reports: boolean;
  doctor_profile?: {
    doctor_name: string;
    registration_number: string;
    hospital: string;
    submitted_at?: string | null;
    verified_at?: string | null;
  } | null;
};

export type Session = {
  authenticated: boolean;
  account: Account | null;
  doctorVerificationPending: boolean;
};

export const ANONYMOUS: Session = {
  authenticated: false, account: null, doctorVerificationPending: false,
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* private browsing — the session is then tab-scoped only */ }
}

/** The request never reached the API at all — the API is down, or the wrong port. */
export const UNREACHABLE_CODE = "backend_unreachable";

export function isUnreachable(e: any): boolean {
  return e?.code === UNREACHABLE_CODE;
}

/**
 * fetch() that tells "the server said no" apart from "there was no server".
 *
 * `fetch` rejects with a bare `TypeError: Failed to fetch` for every transport-level
 * failure — API not running, wrong port, DNS, and a CORS-blocked response too. That
 * message then travelled all the way to the login screen unchanged, because nothing
 * between here and there caught it, which is why a stopped backend and a server-side
 * 500 both read as "Failed to fetch" and neither said what to do. Converting it to a
 * coded error here means every caller gets a sentence naming the actual problem.
 */
async function netFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw Object.assign(new Error(SIGN_IN_ERROR_MESSAGES[UNREACHABLE_CODE]),
                        { code: UNREACHABLE_CODE });
  }
}

/** fetch() with the session token attached. Use for every protected call. */
export async function authFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return netFetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
}

async function errorOf(r: Response): Promise<{
  code: string; message: string; retry_after?: number; attempts_remaining?: number;
}> {
  const body = await r.json().catch(() => null);
  const e = body?.detail?.error || body?.error;
  if (e?.message) return e;
  if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
    return { code: "invalid_input", message: body.detail[0].msg.replace(/^Value error, /, "") };
  }
  return { code: "request_failed", message: `Something went wrong (${r.status}).` };
}

// ------------------------------------------------------------------ sign-in
//
// Sign in with Google. The browser gets a Google ID token from Google Identity Services
// (components/GoogleButton.tsx) and hands it to the API, which verifies it server-side
// and returns OUR session token. The browser never tells the API who it is — the
// verified token does.
export type GoogleSignInBody = {
  credential: string;
  /** "login": existing account (a patient is created on first use). "signup": may
   *  create a doctor account with its registration details. */
  intent: "login" | "signup";
  role?: "user" | "doctor";
  doctor_profile?: { doctor_name: string; registration_number: string; hospital: string };
  /** Optional WhatsApp delivery number, E.164. */
  mobile?: string;
};

export type SignInResult = {
  ok: true;
  created: boolean;
  token: string;
  account: Account;
  next: string;
  doctor_verification_pending: boolean;
};

export async function signInWithGoogle(body: GoogleSignInBody): Promise<SignInResult> {
  const r = await netFetch(`${API_BASE}/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await errorOf(r);
    throw Object.assign(new Error(e.message), { code: e.code });
  }
  const parsed: SignInResult = await r.json();
  setToken(parsed.token);
  return parsed;
}

/** The Google OAuth client ID: from the build env if set, otherwise from the API. */
export async function googleClientId(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (fromEnv) return fromEnv;
  try {
    const r = await netFetch(`${API_BASE}/v1/auth/config`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()).google_client_id || null;
  } catch {
    return null;
  }
}

/** Set (or clear, with null) the signed-in account's WhatsApp delivery number. */
export async function setWhatsAppNumber(mobile: string | null): Promise<Account> {
  const r = await authFetch("/v1/auth/me/whatsapp", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile }),
  });
  if (!r.ok) {
    const e = await errorOf(r);
    throw Object.assign(new Error(e.message), { code: e.code });
  }
  return (await r.json()).account;
}

export async function fetchSession(): Promise<Session> {
  if (!getToken()) return ANONYMOUS;
  const r = await authFetch("/v1/auth/session");
  if (!r.ok) return ANONYMOUS;
  const body = await r.json();
  if (!body.authenticated) return ANONYMOUS;
  return {
    authenticated: true,
    account: body.account,
    doctorVerificationPending: Boolean(body.doctor_verification_pending),
  };
}

export async function logout() {
  try { await authFetch("/v1/auth/logout", { method: "POST" }); } catch { /* best effort */ }
  setToken(null);
}

// ------------------------------------------------------------------ helpers
/** Display form for an Indian mobile: +919876543210 -> +91 98765 43210 */
export function formatMobile(mobile: string): string {
  const m = mobile.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : mobile;
}

/** What the user typed -> what the API expects. Mirrors the backend normaliser. */
export function normaliseMobile(raw: string): string | null {
  const s = raw.replace(/[\s\-()]/g, "");
  if (/^\+\d{8,15}$/.test(s)) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

export const ROLE_LABEL: Record<string, string> = {
  user: "USER", doctor: "DOCTOR", admin: "ADMIN",
};

/**
 * Backend error code -> what the person should read.
 *
 * The backend already sends a human message; this exists so the UI can say something
 * sharper for the cases the brief calls out (SMS failed, invalid, expired, too many
 * attempts) and so an unrecognised code still produces a sentence rather than a code.
 */
export const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  // Transport, not HTTP: the request never reached the API. Named separately from every
  // server-side refusal because the fix is completely different — start the backend.
  [UNREACHABLE_CODE]:
    "Cannot connect to the screening server. Make sure the API is running " +
    "(`make api` on port 8080), then try again.",
  internal_error: "The server hit an unexpected error. Check the API logs and try again.",
  account_suspended:
    "This account is not active. Contact the programme administrator.",
  doctor_signup_required:
    "There is no doctor account for this Google account yet. Create a doctor account first.",
  google_not_configured:
    "Sign in with Google is not set up on this server (GOOGLE_CLIENT_ID is missing).",
  google_token_invalid: "Google sign-in could not be verified. Try again.",
  google_email_unverified: "This Google account’s email is not verified.",
  google_unavailable: "Could not reach Google to verify sign-in. Try again.",
  google_popup_failed: "Google sign-in was closed or blocked. Try again.",
};

export function signInErrorMessage(e: any): string {
  const code = e?.code as string | undefined;
  if (code && SIGN_IN_ERROR_MESSAGES[code]) return SIGN_IN_ERROR_MESSAGES[code];
  return e?.message || "Something went wrong. Try again.";
}
