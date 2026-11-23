"use client";
/**
 * Add a WhatsApp number to the signed-in account.
 *
 * Sign-in is Google, so an account may have no phone number at all. The delivery cards
 * show this instead of a Send button until one is saved. The number is the person's own
 * delivery address — it is saved on THEIR account only (PUT /v1/auth/me/whatsapp has no
 * account id to point elsewhere) and it is not a login credential.
 */
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import { normaliseMobile, setWhatsAppNumber, signInErrorMessage } from "@/lib/auth";

export default function WhatsAppNumberForm() {
  const { t } = useCareBridge();
  const { refresh } = useAuth();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = normaliseMobile(value);
    if (!m) { setError(t("whatsapp.invalidNumber")); return; }
    setError(null);
    setBusy(true);
    try {
      await setWhatsAppNumber(m);
      await refresh();
    } catch (err: any) {
      setError(signInErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="cb-wanumberform">
      <p className="cb-label" style={{ marginTop: 0 }}>{t("whatsapp.addNumberIntro")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="mobileinput" style={{ flex: "1 1 200px" }}>
          <span className="cc">+91</span>
          <input
            type="tel" inputMode="numeric" autoComplete="tel"
            aria-label={t("auth.mobileLabel")}
            placeholder="98765 43210"
            value={value} onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button type="submit" className="cb-wasend" disabled={busy} aria-busy={busy}>
          {busy ? <span className="spin" aria-hidden="true" /> : null} {t("whatsapp.saveNumber")}
        </button>
      </div>
      {error && <p className="cb-waerror" role="alert">{error}</p>}
    </form>
  );
}
