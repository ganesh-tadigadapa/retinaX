"use client";
/**
 * "Share to WhatsApp" — free, no API, no account.
 *
 * The PDF is already in the browser (r.report.pdf_b64). On phones that support sharing
 * files (Android Chrome, iOS Safari), the system share sheet opens with the PDF attached
 * and the patient picks WhatsApp and a chat. Elsewhere (most laptops) the PDF is
 * downloaded and WhatsApp opens with a short message, so the file can be attached by hand.
 *
 * The message text names only the scan reference, never the grade: it may sit in a chat
 * list or a lock-screen preview, and the clinical detail belongs inside the PDF.
 */
import { MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalyzeResult } from "@/lib/api";
import { useCareBridge } from "./CareBridgeProvider";

function pdfFile(b64: string, filename: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: "application/pdf" });
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined"
      && typeof navigator.share === "function"
      && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export default function ShareToWhatsApp({ r }: { r: AnalyzeResult }) {
  const { t } = useCareBridge();
  const b64 = r.report?.pdf_b64;
  const filename = r.report?.filename || `retinex-report-${r.scan_id}.pdf`;
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Decided after mount: the server render has no navigator.
  useEffect(() => {
    if (b64) setNative(canShareFile(pdfFile(b64, filename)));
  }, [b64, filename]);

  if (!b64) return null;

  const message = t("shareWa.message", { ref: r.scan_id });

  const share = async () => {
    setError(false);
    setBusy(true);
    const file = pdfFile(b64, filename);
    try {
      if (canShareFile(file)) {
        await navigator.share({ files: [file], title: t("shareWa.title"), text: message });
        return;
      }
      // Fallback: download, then open WhatsApp (app on phones, WhatsApp Web on laptops).
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    } catch (e: any) {
      // The person closing the share sheet is not an error.
      if (e?.name !== "AbortError") setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cb-section cb-sharewa" aria-labelledby="cb-sharewa-h">
      <div className="eyebrow">
        <span aria-hidden="true"><Share2 className="ico" size={16} strokeWidth={1.75} /></span>{" "}
        {t("shareWa.eyebrow")}
      </div>
      <h3 id="cb-sharewa-h" className="cb-h">{t("shareWa.title")}</h3>
      <p className="cb-lede">{t("shareWa.body")}</p>

      <button type="button" className="cb-wabtn" onClick={share} disabled={busy}>
        <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
        {busy ? t("shareWa.opening") : t("shareWa.button")}
      </button>

      {!native && <p className="cb-note">{t("shareWa.desktopNote")}</p>}
      {error && <p className="err" role="alert" style={{ marginTop: 10 }}>{t("shareWa.failed")}</p>}
    </section>
  );
}
