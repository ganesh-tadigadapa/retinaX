"use client";
/** Shared chrome for /login and /signup so the two pages are visibly one system. */
import Link from "next/link";
import { Eye } from "lucide-react";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import LanguageControl from "@/components/carebridge/LanguageControl";

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string; subtitle: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const { t } = useCareBridge();
  return (
    <div className="wrap">
      <header className="site" style={{ marginBottom: 0 }}>
        <div className="brandrow">
          <Link href="/" className="auth-logo">
            <span className="sb-mark" aria-hidden="true"><Eye size={20} strokeWidth={2.2} /></span>
            <span>
              <h1 className="brand">RETINEX</h1>
              <span className="sub">{t("common.brand")} · SIH26038</span>
            </span>
          </Link>
          {/* The language has to be changeable before there is an account to attach it
              to — otherwise the first screen is the one nobody can read. */}
          <div className="brandright">
            <LanguageControl />
            <Link href="/" className="sub" style={{ textDecoration: "none" }}>
              ← {t("nav.overview")}
            </Link>
          </div>
        </div>
      </header>

      <div className="authpage">
        <div className="card authcard">
          <h2 className="authtitle">{title}</h2>
          <p className="authsub">{subtitle}</p>
          {children}
          {footer && <div className="authfoot">{footer}</div>}
          <p className="cb-note">{t("auth.noPassword")} {t("auth.languageStays")}</p>
        </div>

        <aside className="authaside">
          <div className="eyebrow">Why Google sign-in</div>
          <p>
            There is no password to remember or reset, and no code to wait for. Google
            confirms who you are; this service never sees your Google password.
          </p>
          <div className="eyebrow" style={{ marginTop: 18 }}>Two kinds of account</div>
          <p>
            A <strong>patient account</strong> screens images and sees its own results. A{" "}
            <strong>doctor account</strong> can additionally open the anonymised report
            queue — once a programme administrator has confirmed the medical registration.
          </p>
          <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>
            Reports carry a scan identifier only. No patient name or phone number is
            stored in, or shown on, the clinician view.
          </p>
        </aside>
      </div>

      <footer className="site">
        <p>Screening triage aid. Not a diagnostic device. Not for clinical use.</p>
      </footer>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="fieldlabel">{children}</span>;
}

/** Patient | Doctor segmented control used by /login and /signup. A REQUEST only:
 *  the server decides the role an account actually has. */
export function RoleToggle({ role, onChange }: {
  role: "user" | "doctor"; onChange: (r: "user" | "doctor") => void;
}) {
  return (
    <div className="roletoggle" role="group" aria-label="Account type">
      <button type="button" className={role === "user" ? "on" : ""}
              aria-pressed={role === "user"} onClick={() => onChange("user")}>
        Patient
      </button>
      <button type="button" className={role === "doctor" ? "on" : ""}
              aria-pressed={role === "doctor"} onClick={() => onChange("doctor")}>
        Doctor
      </button>
    </div>
  );
}
