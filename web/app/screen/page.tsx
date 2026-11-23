"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CloudUpload, Info, ArrowDown } from "lucide-react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import PageHeader from "@/components/PageHeader";
import Samples, { type Sample } from "@/components/Samples";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import LanguageOnboarding from "@/components/carebridge/LanguagePicker";
import CareResult from "@/components/carebridge/CareResult";
import ComparisonCard from "@/components/passport/ComparisonCard";
import ComparisonDelivery from "@/components/passport/ComparisonDelivery";
import FollowUpCard from "@/components/passport/FollowUpCard";
import GradeTimeline from "@/components/passport/GradeTimeline";
import ReturningBanner from "@/components/passport/ReturningBanner";
import { analyze, downscale, type AnalyzeResult } from "@/lib/api";
import { getPassport, type Passport } from "@/lib/passport";

export default function Screen() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientRef, setPatientRef] = useState("");
  const [over, setOver] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  /**
   * The longitudinal answer for the screening that just finished.
   *
   * Fetched SEPARATELY, after `/v1/analyze` has returned, and deliberately so: the
   * analyse response contract is unchanged, and a screening result must not start
   * depending on how many times this person has been screened before. A failure here
   * leaves the result on the page untouched.
   */
  const [passport, setPassport] = useState<Passport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { t, tList } = useCareBridge();

  /**
   * Bring the finished result into view.
   *
   * CareResult renders full width BELOW the upload form and the samples grid, which puts
   * it roughly 2000px down the page — about two screens below the fold on a laptop. The
   * screening itself is fine, but nothing in the visible area changes when it lands, and
   * the "what you get" card that was sitting there is replaced by the result further
   * down. Clicking a sample therefore looked like it did nothing at all.
   *
   * A refusal (HTTP 422) sets `result` on the same path, so the recapture instruction
   * scrolls into view too — that message is useless to a health worker who cannot see it.
   */
  useEffect(() => {
    if (!result) return;
    const el = resultRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [result]);

  const run = useCallback(async (file: File, note?: string) => {
    setBusy(true); setError(null); setResult(null); setElapsed(null);
    setPassport(null);
    setSampleNote(note ?? null);
    setPreview(URL.createObjectURL(file));
    const t0 = performance.now();
    try {
      const small = await downscale(file);
      const r = await analyze(small, patientRef || undefined);
      setResult(r);
      setElapsed(Math.round(performance.now() - t0));
      // The comparison, the updated timeline and the next follow-up. Best effort: the
      // screening result above is already on the page and stays there if this fails.
      getPassport().then(setPassport).catch(() => setPassport(null));
    } catch (e: any) {
      setError(e?.message || t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }, [patientRef, t]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) run(f);
  };

  const downloadPdf = () => {
    if (!result?.report?.pdf_b64) return;
    const bin = atob(result.report.pdf_b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url; a.download = result.report.filename || "dr-report.pdf";
    a.click(); URL.revokeObjectURL(url);
  };

  const step = result ? 3 : busy ? 2 : 1;
  const STEPS = ["Upload", "Analyze", "Results"];

  return (
    <Guard>
    <Shell>
      {/* Shown only until the person has actually chosen a language. */}
      <LanguageOnboarding />
      <PageHeader eyebrow={t("nav.screen")} title={t("screen.title")}>
        {t("screen.subtitle")}
      </PageHeader>
      {/* "Your previous screening is available." Renders nothing for a first-time
          patient, and asks the server rather than guessing from this browser. */}
      <ReturningBanner />

      <div className="rx-screen">
        <ol className="rx-stepper" aria-label="Screening progress">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "now" : "todo";
            return (
              <li key={label} className={`rx-step ${state}`} aria-current={state === "now" ? "step" : undefined}>
                <span className="rx-stepdot">{state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : n}</span>
                <span className="rx-steplabel">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="rx-uploadcard">
          <div
            className={`drop rx-drop ${over ? "over" : ""}`}
            onClick={() => !busy && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            aria-busy={busy}
            onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
          >
            <input
              ref={inputRef} type="file" accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); }}
            />
            {busy && preview ? (
              <div className="rx-analyzing">
                <div className="rx-analyzingimg">
                  <img src={preview} alt={t("screen.asUploaded")} />
                  <span className="rx-scan" aria-hidden="true" />
                </div>
                <div className="rx-droptitle"><span className="spin" /> {t("screen.analyzing")}</div>
                <div className="rx-drophint">{t("screen.analyzingHint")}</div>
              </div>
            ) : result && preview ? (
              // After a result: show what was screened and point down to the result, so
              // scrolling back up never looks like an empty, unfinished upload.
              <div className="rx-analyzing rx-done-upload">
                <div className="rx-analyzingimg">
                  <img src={preview} alt={t("screen.asUploaded")} />
                </div>
                <button
                  type="button"
                  className="linkbtn rx-droptitle"
                  onClick={(e) => {
                    e.stopPropagation();
                    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {t("screen.resultBelow")} <ArrowDown size={16} aria-hidden="true" />
                </button>
                <span className="cta solid rx-choose">{t("screen.screenAnother")}</span>
              </div>
            ) : (
              <>
                <span className="rx-dropicon" aria-hidden="true"><CloudUpload size={34} strokeWidth={1.6} /></span>
                <div className="rx-droptitle">{t("screen.upload")}</div>
                <div className="rx-drophint">{t("screen.uploadHint")}</div>
                <div className="rx-dropmeta">Supports JPG and PNG</div>
                <span className="cta solid rx-choose">Choose Image</span>
              </>
            )}
          </div>

          <label className="rx-field">
            <span>{t("screen.patientRef")}</span>
            <input
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
              placeholder="PHC-2026-0001"
              className="txt"
            />
          </label>

          <Samples
            disabled={busy}
            onPick={(f: File, sm: Sample) =>
              run(f, `Sample: ${sm.title} — expected to be ${sm.expect}.`)}
          />

          <div className="rx-tip">
            <Info size={20} aria-hidden="true" />
            <div>
              <div className="rx-tiptitle">{t("screen.whatYouGetTitle")}</div>
              <ul>
                {tList("screen.whatYouGet").map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              <Link href="/how-it-works">See how the screening works <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>

          {error && <div className="err">{error}</div>}
          {sampleNote && <div className="muted" style={{ fontSize: ".8rem" }}>{sampleNote}</div>}
        </div>
      </div>

      {/* Same AnalyzeResult, presented for the person it is about. CareResult re-orders
          and translates; it renders the existing clinical components unchanged inside
          its clinical section, and calls nothing. Full width, because a patient reading
          their own result should not be doing it in a side column. */}
      {result && (
        <div className="cb-results" ref={resultRef}>
          <CareResult r={result} onDownload={downloadPdf} image={preview ?? undefined} />

          {/* ---- CareBridge Eye Health Passport -------------------------------
              What changed since last time, the timeline it sits on, the follow-up
              that comes out of it, and the comparison report on WhatsApp. All of it
              is drawn from the passport endpoints; none of it can change the result
              above. */}
          {passport?.has_history && (
            <>
              <ComparisonCard comparison={passport.latest_comparison} />
              {passport.timeline.length > 1 && (
                <section className="cb-section" aria-labelledby="pp-scr-tl">
                  <h3 id="pp-scr-tl" className="cb-h">
                    {t("passport.timelineTitle")}
                  </h3>
                  <GradeTimeline points={passport.timeline} />
                </section>
              )}
              <FollowUpCard followUp={passport.follow_up} />
              {passport.latest_comparison?.available && (
                <ComparisonDelivery screeningId={result.scan_id} />
              )}
            </>
          )}
          {elapsed !== null && (
            <div className="muted mono" style={{ fontSize: ".76rem" }}>
              {elapsed} ms end-to-end from this browser · scan {result.scan_id}
            </div>
          )}
        </div>
      )}
    </Shell>
    </Guard>
  );
}
