"use client";
/**
 * Create an account with Google: choose Patient or Doctor, fill in what that needs, then
 * continue with Google.
 *
 * What has NOT changed is that choosing "Doctor" grants nothing. The backend creates
 * every doctor with `doctor_verified = false` (src/auth/storage.py::create) and only
 * `service.approve_doctor()` — an admin endpoint or a local script — can change that.
 * This form records a claim for a human to check.
 *
 * The WhatsApp number is optional and is not a login credential; it is only where
 * reports are sent, and can be added later from the result page.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthLayout, FieldLabel, RoleToggle } from "@/components/AuthCard";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import { useAuth } from "@/components/AuthProvider";
import GoogleButton from "@/components/GoogleButton";
import { normaliseMobile, signInErrorMessage, signInWithGoogle } from "@/lib/auth";

type Role = "user" | "doctor";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useCareBridge();
  const { refresh, authenticated, account } = useAuth();

  const [done, setDone] = useState(false);
  const [role, setRole] = useState<Role>("user");
  const [mobile, setMobile] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [hospital, setHospital] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /signup?role=doctor (from the login page) preselects the doctor form. Read once on
  // the client rather than via useSearchParams, which would force a Suspense boundary.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("role") === "doctor") {
        setRole("doctor");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!done && authenticated && account) {
      router.replace(account.can_read_reports ? "/reports" : "/screen");
    }
  }, [done, authenticated, account, router]);

  /** Everything checkable before Google is involved. Returns an error sentence or null. */
  const problem = (): string | null => {
    if (mobile.trim() && !normaliseMobile(mobile)) return "Enter a 10-digit mobile number.";
    if (role === "doctor") {
      if (doctorName.trim().length < 2) return "Enter the doctor’s full name.";
      if (regNumber.trim().length < 3) return "Enter the medical registration number.";
      if (hospital.trim().length < 2) return "Enter the hospital or clinic name.";
    }
    return null;
  };

  const onCredential = async (credential: string) => {
    setError(null);
    const p = problem();
    if (p) { setError(p); return; }
    setBusy(true);
    try {
      const r = await signInWithGoogle({
        credential,
        intent: "signup",
        role,
        mobile: mobile.trim() ? normaliseMobile(mobile) || undefined : undefined,
        doctor_profile: role === "doctor"
          ? {
              doctor_name: doctorName.trim(),
              registration_number: regNumber.trim(),
              hospital: hospital.trim(),
            }
          : undefined,
      });
      await refresh();
      if (r.doctor_verification_pending) {
        setDone(true);
      } else {
        router.replace(r.next || "/screen");
      }
    } catch (err: any) {
      setError(signInErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.createTitle")}
      subtitle={t("auth.createSub")}
      footer={done ? undefined : <>Already registered? <Link href="/login">Sign in</Link></>}
    >
      {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}

      {!done && (
        <div>
          <div className="field">
            <FieldLabel>Choose account type</FieldLabel>
            <RoleToggle role={role} onChange={(r) => { setRole(r); setError(null); }} />
            <p className="cb-note" style={{ marginTop: 10 }}>
              {role === "doctor"
                ? "Everything a patient can do, plus the anonymised report queue after verification."
                : "Screen retinal images and see your own results."}
            </p>
          </div>

          {role === "doctor" && (
            <div className="verifyblock">
              <div className="eyebrow">Verification information</div>
              <p className="verifynote">
                Checked by a programme administrator before the reports area opens.
                Your account is created immediately, with reports access pending.
              </p>
              <label className="field">
                <FieldLabel>Doctor Name</FieldLabel>
                <input className="txt" value={doctorName} onChange={(e) => setDoctorName(e.target.value)}
                       placeholder="Dr A. Sharma" autoComplete="name" />
              </label>
              <label className="field">
                <FieldLabel>Medical Registration Number</FieldLabel>
                <input className="txt mono" value={regNumber} onChange={(e) => setRegNumber(e.target.value)}
                       placeholder="TN/12345/2018" />
              </label>
              <label className="field">
                <FieldLabel>Hospital / Clinic Name</FieldLabel>
                <input className="txt" value={hospital} onChange={(e) => setHospital(e.target.value)}
                       placeholder="District Hospital, Erode" />
              </label>
            </div>
          )}

          <label className="field">
            <FieldLabel>{t("auth.mobileLabel")}</FieldLabel>
            <div className="mobileinput">
              <span className="cc">+91</span>
              <input
                type="tel" inputMode="numeric" autoComplete="tel"
                placeholder="98765 43210"
                value={mobile} onChange={(e) => setMobile(e.target.value)}
              />
            </div>
            <span className="cb-note">{t("auth.whatsappHint")}</span>
          </label>

          <GoogleButton onCredential={onCredential} text="signup_with" disabled={busy} />
          {busy && (
            <p className="muted" style={{ textAlign: "center", marginTop: 10 }}>
              <span className="spin" /> Creating your account…
            </p>
          )}
        </div>
      )}

      {done && (
        <div>
          <div className="pendingbox">
            <strong>Doctor verification pending.</strong>
            <p style={{ margin: "6px 0 0" }}>
              Your account is active. A programme administrator has to confirm your
              medical registration ({regNumber || "—"}) before the reports area opens.
            </p>
          </div>
          <p className="muted" style={{ fontSize: ".88rem" }}>
            You can screen images and review results now. The Reports tab appears on its
            own once you are approved.
          </p>
          <Link href="/screen" className="cta solid" style={{ display: "inline-block" }}>
            Go to screening
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
