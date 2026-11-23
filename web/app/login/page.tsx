"use client";
/**
 * Sign in with Google, as a Patient or a Doctor.
 *
 * The toggle is a REQUEST, not a grant. An existing account signs in with the role it
 * already has, whatever is selected here; a new Google account selecting "Patient" gets
 * a patient account, and one selecting "Doctor" is sent to signup, because a doctor
 * account needs registration details an administrator can check.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthLayout, RoleToggle } from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import GoogleButton from "@/components/GoogleButton";
import { signInErrorMessage, signInWithGoogle } from "@/lib/auth";

type Role = "user" | "doctor";

export default function LoginPage() {
  const router = useRouter();
  const { refresh, authenticated, account } = useAuth();
  const { t } = useCareBridge();

  const [role, setRole] = useState<Role>("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; text: string } | null>(null);

  // Already signed in? Don't make them do it again.
  useEffect(() => {
    if (authenticated && account) {
      router.replace(account.can_read_reports ? "/reports" : "/screen");
    }
  }, [authenticated, account, router]);

  const onCredential = async (credential: string) => {
    setError(null);
    setBusy(true);
    try {
      // `next` is computed by the BACKEND from the stored role. The browser does not
      // decide where a doctor lands, because the browser does not decide who is one.
      const r = await signInWithGoogle({ credential, intent: "login", role });
      await refresh();
      router.replace(r.next || "/screen");
    } catch (err: any) {
      setError({ code: err?.code, text: signInErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSub")}
      footer={
        <>
          Don’t have an account? <Link href={`/signup?role=${role}`}>Create Account</Link>
        </>
      }
    >
      {error && (
        <div className="err" style={{ marginBottom: 14 }}>
          {error.text}
          {error.code === "doctor_signup_required" && (
            <> <Link href="/signup?role=doctor">Create a doctor account</Link></>
          )}
        </div>
      )}

      <RoleToggle role={role} onChange={(r) => { setRole(r); setError(null); }} />

      <p className="cb-note" style={{ margin: "14px 0" }}>
        {role === "doctor"
          ? "Doctors see the report queue once a programme administrator has verified their registration."
          : "Screen retinal images and see your own results and history."}
      </p>

      <GoogleButton onCredential={onCredential} text="signin_with" disabled={busy} />
      {busy && (
        <p className="muted" style={{ textAlign: "center", marginTop: 10 }}>
          <span className="spin" /> Signing you in…
        </p>
      )}
    </AuthLayout>
  );
}
