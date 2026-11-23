/**
 * Sign in with Google, as a Patient or a Doctor.
 *
 * `fetch` is stubbed in every test, and Google's button is replaced by a plain button
 * that hands back a fake ID token — so the only thing these pages can talk to is a
 * recorded fake of this project's own API.
 *
 * The properties worth protecting:
 *   * the browser never decides where a doctor lands — the backend's `next` does;
 *   * a role can be REQUESTED at signup but never granted by the client;
 *   * the Google credential is what reaches the API, never a typed identity;
 *   * the session token is stored, and nothing else is;
 *   * refusals read as sentences, never as codes.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CareBridgeProvider from "@/components/carebridge/CareBridgeProvider";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";

const CREDENTIAL = "fake-google-id-token";

vi.mock("@/components/GoogleButton", () => ({
  default: ({ onCredential, disabled }: { onCredential: (c: string) => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onCredential(CREDENTIAL)}>
      Google
    </button>
  ),
}));

const session = { authenticated: false, account: null as any, refresh: vi.fn() };
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => session,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const replaced: string[] = [];
vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useRouter: () => ({ replace: (p: string) => { replaced.push(p); }, push: () => {} }),
}));

type Call = { url: string; body: any };

const OK_SESSION = {
  ok: true, created: false, token: "app-session-token", token_type: "bearer",
  account: { account_id: "acc_1", email: "p@gmail.com", mobile: null, role: "user",
             can_read_reports: false, doctor_verified: false },
  next: "/screen", doctor_verification_pending: false,
};

function stubApi(status = 200, body: any = OK_SESSION): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init?.body || "{}") });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
  }));
  return calls;
}

const refusal = (code: string, message: string) => ({ detail: { error: { code, message } } });

const renderLogin = () => render(<CareBridgeProvider><LoginPage /></CareBridgeProvider>);
const renderSignup = () => render(<CareBridgeProvider><SignupPage /></CareBridgeProvider>);
const clickGoogle = () => fireEvent.click(screen.getByRole("button", { name: "Google" }));

beforeEach(() => {
  replaced.length = 0;
  session.authenticated = false;
  session.account = null;
  session.refresh = vi.fn();
  window.localStorage.clear();
  stubApi();
});

// ------------------------------------------------------------------- sign-in
describe("sign-in", () => {
  it("offers Patient / Doctor and Google, and no phone or code field", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Patient" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Doctor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google" })).toBeTruthy();
    expect(document.querySelectorAll("input")).toHaveLength(0);
    const text = (document.body.textContent || "").toLowerCase();
    for (const gone of ["otp", "verification code", "resend"]) expect(text).not.toContain(gone);
  });

  it("sends the Google credential as a patient login", async () => {
    const calls = stubApi();
    renderLogin();
    clickGoogle();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain("/v1/auth/google");
    expect(calls[0].body).toEqual({ credential: CREDENTIAL, intent: "login", role: "user" });
  });

  it("sends role=doctor when the Doctor toggle is on", async () => {
    const calls = stubApi();
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Doctor" }));
    clickGoogle();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body.role).toBe("doctor");
  });

  it("stores the application session token", async () => {
    renderLogin();
    clickGoogle();
    await waitFor(() =>
      expect(window.localStorage.getItem("dr_session_token")).toBe("app-session-token"));
  });

  it("goes where the BACKEND says, not where the browser thinks", async () => {
    stubApi(200, { ...OK_SESSION, next: "/reports",
                   account: { ...OK_SESSION.account, role: "doctor", can_read_reports: true } });
    renderLogin();
    clickGoogle();
    await waitFor(() => expect(replaced).toContain("/reports"));
  });

  it("points a doctor with no account to doctor signup", async () => {
    stubApi(404, refusal("doctor_signup_required", "No doctor account."));
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Doctor" }));
    clickGoogle();
    const link = await screen.findByRole("link", { name: /create a doctor account/i });
    expect(link.getAttribute("href")).toBe("/signup?role=doctor");
    expect(window.localStorage.getItem("dr_session_token")).toBeNull();
  });
});

// -------------------------------------------------------------- error states
describe("error states", () => {
  it("surfaces a suspended account rather than signing in", async () => {
    stubApi(403, refusal("account_suspended", "This account is not active."));
    renderLogin();
    clickGoogle();
    expect(await screen.findByText(/not active/i)).toBeTruthy();
    expect(window.localStorage.getItem("dr_session_token")).toBeNull();
    expect(replaced).toHaveLength(0);
  });

  it("explains a Google verification failure", async () => {
    stubApi(401, refusal("google_token_invalid", "x"));
    renderLogin();
    clickGoogle();
    expect(await screen.findByText(/could not be verified/i)).toBeTruthy();
  });

  it("says the backend is unreachable when the request cannot connect", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    renderLogin();
    clickGoogle();
    expect(await screen.findByText(/cannot connect to the screening server/i)).toBeTruthy();
  });

  it("never shows a raw error code to the person", async () => {
    stubApi(403, refusal("account_suspended", "This account is not active."));
    renderLogin();
    clickGoogle();
    await screen.findByText(/not active/i);
    const text = document.body.textContent || "";
    for (const leak of ["account_suspended", "detail", "Traceback"]) {
      expect(text).not.toContain(leak);
    }
  });
});

// -------------------------------------------------------------------- signup
describe("signup", () => {
  it("creates a patient account with no WhatsApp number", async () => {
    const calls = stubApi(200, { ...OK_SESSION, created: true });
    renderSignup();
    clickGoogle();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain("/v1/auth/google");
    expect(calls[0].body).toEqual({ credential: CREDENTIAL, intent: "signup", role: "user" });
  });

  it("sends an optional WhatsApp number normalised to E.164", async () => {
    const calls = stubApi(200, { ...OK_SESSION, created: true });
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText("98765 43210"),
                     { target: { value: "98765 43210" } });
    clickGoogle();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body.mobile).toBe("+919876543210");
  });

  it("refuses a malformed WhatsApp number without calling the API", async () => {
    const calls = stubApi();
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText("98765 43210"), { target: { value: "123" } });
    clickGoogle();
    await screen.findByText(/enter a 10-digit mobile number/i);
    expect(calls).toHaveLength(0);
  });

  it("refuses to submit a doctor account without the claimed credentials", async () => {
    const calls = stubApi();
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "Doctor" }));
    clickGoogle();
    await screen.findByText(/enter the doctor.s full name/i);
    expect(calls).toHaveLength(0);
  });

  it("sends the doctor claim, and lands on pending rather than on reports", async () => {
    const calls = stubApi(200, {
      ...OK_SESSION, created: true, doctor_verification_pending: true,
      account: { ...OK_SESSION.account, role: "doctor", doctor_verified: false,
                 can_read_reports: false },
    });
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "Doctor" }));
    fireEvent.change(screen.getByPlaceholderText("Dr A. Sharma"),
                     { target: { value: "Dr Rao" } });
    fireEvent.change(screen.getByPlaceholderText("TN/12345/2018"),
                     { target: { value: "TN-12345" } });
    fireEvent.change(screen.getByPlaceholderText("District Hospital, Erode"),
                     { target: { value: "District Hospital" } });
    clickGoogle();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body.role).toBe("doctor");
    expect(calls[0].body.doctor_profile).toEqual({
      doctor_name: "Dr Rao",
      registration_number: "TN-12345",
      hospital: "District Hospital",
    });
    // The claim does not become a privilege: the UI lands on "pending", not /reports.
    expect(await screen.findByText(/verification pending/i)).toBeTruthy();
    expect(replaced).not.toContain("/reports");
  });
});
