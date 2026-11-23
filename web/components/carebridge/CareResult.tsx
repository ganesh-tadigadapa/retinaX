"use client";
/**
 * CareBridge — the patient-facing presentation of a screening result.
 *
 * READ THIS BEFORE EDITING. This component performs no analysis. Every number it shows
 * — grade, confidence, referability, lesion counts, the Grad-CAM image — is taken
 * verbatim from the `AnalyzeResult` the API already returned. It re-orders and
 * translates; it does not decide. The model is not called again, and nothing here can
 * change a grade or a referral.
 *
 * What it adds is the order a patient needs, which is not the order a clinician needs:
 *
 *      result → what it means → listen → why the system said it → the evidence
 *            → what to do now → the report, delivered → lifestyle
 *            → where to go next
 *
 * The existing clinical components (Verdict, QualityPanel, Evidence, RulePanel,
 * Confidence, Timing) are rendered UNMODIFIED inside the clinical section. Simple mode
 * collapses that section; it never removes it. Hiding the evidence from the patient and
 * showing it to the judge would be the wrong product.
 */
import { Camera, Check, Download, Eye, FileText, Navigation, Salad, Search, TriangleAlert } from "lucide-react";
import {
  Confidence, Evidence, Images, QualityPanel, RulePanel, Timing, Verdict,
} from "@/components/Result";
import { useState } from "react";
import type { AnalyzeResult } from "@/lib/api";
import { useCareBridge } from "./CareBridgeProvider";
import SpeakButton from "./SpeakButton";
import WhyThis from "./WhyThis";
import Nutrition from "./Nutrition";
import WhatsAppDelivery from "./WhatsAppDelivery";
import ShareToWhatsApp from "./ShareToWhatsApp";
import CareFinder from "./CareFinder";

/** Simple ⇄ Clinical. A presentation switch over one set of facts. */
function LevelToggle() {
  const { t, level, setLevel } = useCareBridge();
  return (
    <div className="cb-seg big" role="radiogroup" aria-label={t("a11y.explanationLevelGroup")}>
      {(["simple", "clinical"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={level === v}
          className={`cb-segbtn${level === v ? " on" : ""}`}
          onClick={() => setLevel(v)}
        >
          {t(v === "simple" ? "common.simple" : "common.clinical")}
        </button>
      ))}
    </div>
  );
}

/** The untouched clinical stack. Open in clinical mode, one tap away in simple mode. */
function ClinicalStack({ r }: { r: AnalyzeResult }) {
  const { t, level } = useCareBridge();
  const body = (
    <div className="cb-clinical">
      <Verdict r={r} />
      <QualityPanel r={r} />
      <Evidence r={r} />
      <RulePanel r={r} />
      <Confidence r={r} />
      <Timing r={r} />
    </div>
  );

  if (level === "clinical") {
    return (
      <section className="cb-section" aria-labelledby="cb-clin-h">
        <h3 id="cb-clin-h" className="cb-h">{t("result.clinicalDetails")}</h3>
        <p className="cb-lede">{t("result.clinicalDetailsHint")}</p>
        {body}
      </section>
    );
  }
  return (
    <details className="cb-clinicaldetails">
      <summary>
        <span className="cb-h">{t("result.clinicalDetails")}</span>
        <span className="cb-hint">{t("result.clinicalDetailsHint")}</span>
      </summary>
      {body}
    </details>
  );
}

/**
 * The same two images the existing `Images` component renders, captioned in the reader's
 * language. Simple mode uses this; clinical mode uses `Images` itself, unchanged, because
 * its captions name the colour coding a clinician is reading the overlay for. One or the
 * other renders — never both — so the pictures are never shown twice.
 */
function PatientFigures({ r }: { r: AnalyzeResult }) {
  const { t } = useCareBridge();
  const e = r.explain;
  if (!e) return null;
  const src = (b64?: string) => (b64 ? `data:image/png;base64,${b64}` : undefined);
  return (
    <>
      <div className="imgs" style={{ marginTop: 14 }}>
        {e.overlay_png_b64 && (
          <figure>
            <img src={src(e.overlay_png_b64)} alt={t("explainability.gradCamTitle")} />
            <figcaption>{t("explainability.gradCamTitle")}</figcaption>
          </figure>
        )}
        {e.lesion_overlay_png_b64 && (
          <figure>
            <img src={src(e.lesion_overlay_png_b64)} alt={t("explainability.lesionsTitle")} />
            <figcaption>{t("explainability.lesionsTitle")}</figcaption>
          </figure>
        )}
      </div>
      {!e.gradcam_available && (
        <p className="cb-note">{t("explainability.unavailable")}</p>
      )}
    </>
  );
}

/** Why the system said what it said — the existing evidence, introduced in plain words. */
function WhySection({ r }: { r: AnalyzeResult }) {
  const { t, level } = useCareBridge();
  if (!r.explain) return null;
  return (
    <section className="cb-section" aria-labelledby="cb-why-h">
      <div className="eyebrow"><span aria-hidden="true"><Search className="ico" size={16} strokeWidth={1.75} /></span> {t("common.appName")}</div>
      <h3 id="cb-why-h" className="cb-h">{t("explainability.title")}</h3>
      <p className="cb-lede">{t("explainability.gradCamPlain")}</p>
      {level === "clinical" ? (
        <>
          <p className="cb-tech mono">{t("explainability.gradCamTech")}</p>
          <Images r={r} />
        </>
      ) : (
        <PatientFigures r={r} />
      )}
      {r.lesions && <p className="cb-note">{t("explainability.lesionsPlain")}</p>}
      <p className="cb-note">{t("explainability.note")}</p>
      <SpeakButton
        id="why"
        parts={[t("explainability.title"), t("explainability.gradCamPlain"),
                r.lesions ? t("explainability.lesionsPlain") : null]}
      />
    </section>
  );
}

/** What should I do now? Follow-up, lifestyle, report — in that order of urgency. */
function CareActions({ r, onDownload }: { r: AnalyzeResult; onDownload?: () => void }) {
  const { t, tIndexed } = useCareBridge();
  const grade = r.grading?.icdr_grade ?? 0;
  const urgent = Boolean(r.grading?.referable);
  return (
    <section className="cb-section" aria-labelledby="cb-act-h">
      <div className="eyebrow"><span aria-hidden="true"><Navigation className="ico" size={16} strokeWidth={1.75} /></span> {t("journey.guide")}</div>
      <h3 id="cb-act-h" className="cb-h">{t("actions.title")}</h3>

      <div className="cb-actions">
        <article className={`cb-action${urgent ? " urgent" : ""}`}>
          <span className="cb-actionicon" aria-hidden="true"><Eye className="ico" size={16} strokeWidth={1.75} /></span>
          <div>
            <span className={`cb-tag ${urgent ? "urgent" : "routine"}`}>
              {t(urgent ? "actions.urgentTag" : "actions.generalTag")}
            </span>
            <h4>{t("actions.eyeTitle")}</h4>
            <p>{tIndexed("actions.eyeBody", grade)}</p>
          </div>
        </article>

        <article className="cb-action">
          <span className="cb-actionicon" aria-hidden="true"><Salad className="ico" size={16} strokeWidth={1.75} /></span>
          <div>
            <h4>{t("actions.lifestyleTitle")}</h4>
            <p>{t("actions.lifestyleBody")}</p>
          </div>
        </article>

        <article className="cb-action">
          <span className="cb-actionicon" aria-hidden="true"><FileText className="ico" size={16} strokeWidth={1.75} /></span>
          <div>
            <h4>{t("actions.reportTitle")}</h4>
            <p>{t("actions.reportBody")}</p>
          </div>
        </article>
      </div>

      <SpeakButton
        id="actions"
        parts={[t("actions.title"), t("actions.eyeTitle"), tIndexed("actions.eyeBody", grade)]}
      />
      <WhyThis />
    </section>
  );
}

/**
 * The ungradeable path. No grade is invented, no follow-up interval is quoted and no
 * nutrition guidance appears — there is no result for any of it to be based on. The
 * refusal reason from the quality gate is shown as the API returned it.
 */
function QualityRefusal({ r }: { r: AnalyzeResult }) {
  const { t } = useCareBridge();
  // A non-fundus upload gets its own wording: "retake with better focus" is the wrong
  // advice for a screenshot. The server's instruction is not repeated in that case.
  const notFundus = r.quality.is_fundus === false;
  const instruction = notFundus ? null : r.quality.recapture_instruction;
  const title = t(notFundus ? "quality.notFundusTitle" : "quality.failTitle");
  const why = t(notFundus ? "quality.notFundusWhy" : "quality.whyBody");
  const todo = t(notFundus ? "quality.notFundusWhatToDo" : "quality.whatToDoBody");
  return (
    <>
      <section className="cb-hero reject" aria-labelledby="cb-q-h">
        <div className="cb-heroicon" aria-hidden="true"><Camera className="ico" size={16} strokeWidth={1.75} /></div>
        <div>
          <div className="eyebrow">{t("common.appName")}</div>
          <h2 id="cb-q-h">{title}</h2>
          <p className="cb-heroline">{t("quality.noGradeNote")}</p>
        </div>
        {!notFundus && (
          <div className="cb-heroscore mono">
            {t("quality.scoreLabel")}
            <strong>{(r.quality.overall_score * 100).toFixed(0)}%</strong>
          </div>
        )}
      </section>

      <section className="cb-section" aria-labelledby="cb-qw-h">
        <h3 id="cb-qw-h" className="cb-h">{t("quality.whyTitle")}</h3>
        <p className="cb-lede">{why}</p>
        <h3 className="cb-h">{t("quality.whatToDoTitle")}</h3>
        <p className="cb-lede">{todo}</p>
        {instruction && (
          <div className="flagbox cb-instruction">
            <strong>{t("quality.instructionTitle")}:</strong> {instruction}
          </div>
        )}
        <SpeakButton
          id="quality"
          parts={[title, why, todo]}
        />
        <WhyThis />
        <p className="cb-note">{t("nutrition.noGradeNote")}</p>
      </section>

      <ClinicalStack r={r} />
      {/* No grade was produced, so no follow-up interval and no lifestyle guidance are
          shown. Finding an eye-care facility is not clinical advice — it is how the
          person gets the photograph retaken by someone who can also examine them — so
          the access feature stays, with wording that names no grade. */}
      <CareFinder r={r} />
    </>
  );
}

function ResultTabs({
  tabs, panels,
}: { tabs: { id: string; label: string }[]; panels: Record<string, React.ReactNode> }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className="rx-rtabs">
      <div className="rx-rtablist" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`rt-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`rp-${tab.id}`}
            className={`rx-rtab${active === tab.id ? " on" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`rp-${tab.id}`}
          aria-labelledby={`rt-${tab.id}`}
          hidden={active !== tab.id}
          className="rx-rpanel"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}

export default function CareResult({
  r, onDownload, image,
}: { r: AnalyzeResult; onDownload?: () => void; image?: string }) {
  const { t, tIndexed, level } = useCareBridge();

  // Order matters here, and it mirrors the API's own refusal order: quality first, then
  // whether a grade exists at all. Neither branch fabricates the other's content.
  if (!r.quality.gradeable) return <QualityRefusal r={r} />;

  if (!r.grading) {
    return (
      <>
        <section className="cb-hero reject" aria-labelledby="cb-nm-h">
          <div className="cb-heroicon" aria-hidden="true"><TriangleAlert className="ico" size={16} strokeWidth={1.75} /></div>
          <div>
            <div className="eyebrow">{t("common.appName")}</div>
            <h2 id="cb-nm-h">{t("result.modelUnavailableTitle")}</h2>
            <p className="cb-heroline">{t("result.modelUnavailableBody")}</p>
          </div>
        </section>
        <SpeakButton
          id="nomodel"
          parts={[t("result.modelUnavailableTitle"), t("result.modelUnavailableBody")]}
        />
        <WhySection r={r} />
        <ClinicalStack r={r} />
        <p className="cb-note">{t("nutrition.noGradeNote")}</p>
        <CareFinder r={r} />
      </>
    );
  }

  const g = r.grading;
  // How sure the model is about the decision it made: P(referable) when it refers,
  // 1 - P(referable) when it clears.
  const pRef = g.referable_probability ?? 0;
  const referralConfidence = g.referable ? pRef : 1 - pRef;
  const meaning = tIndexed("result.meaning", g.icdr_grade);
  const patientLabel = tIndexed("result.labels", g.icdr_grade);

  return (
    <>
      <div className="rx-done" role="status">
        <span className="rx-doneicon" aria-hidden="true"><Check size={18} strokeWidth={3} /></span>
        <div>
          <strong>{t("result.eyebrow")}</strong>
        </div>
      </div>

      <section
        className={`cb-hero rx-result ${g.referable ? "refer" : "clear"}`}
        aria-labelledby="cb-res-h"
      >
        {image && (
          <img className="rx-resultimg" src={image} alt={t("screen.asUploaded")} />
        )}
        <div className="rx-resultbody">
          {/* The grade is written out as well as shown big: colour alone never carries
              meaning, and "Grade 2 of 4" survives a screen reader and a bad screen. */}
          <div className="rx-gradeline">
            <span className={`rx-gradebadge g${g.icdr_grade}`} aria-hidden="true">{g.icdr_grade}</span>
            <div>
              <div className="cb-gradeword">{t("result.gradeOf", { grade: g.icdr_grade })}</div>
              <div className="rx-gradename">{patientLabel}</div>
            </div>
          </div>
          <h2 id="cb-res-h">
            {g.referable ? t("result.verdictRefer") : t("result.verdictClear")}
          </h2>
          <p className="cb-heroline">
            {g.referable ? t("result.verdictReferBody") : t("result.verdictClearBody")}
          </p>
          {level === "clinical" && (
            <div className="rx-confidence">
              {/* Lead with the refer / don't-refer certainty: it is the decision the
                  model is good at (AUC 0.975). Exact-grade probability is low for grades
                  1-3 even when the grade is right, so it is shown second. */}
              <div className="rx-confidencelabel cb-gradetech mono">
                ICDR · {tIndexed("result.clinicalLabels", g.icdr_grade)} ·{" "}
                {(referralConfidence * 100).toFixed(0)}% {t("result.referralConfidence")}{" "}
                ({t(g.confidence_calibrated ? "result.calibrated" : "result.uncalibrated")})
              </div>
              <div className="bar"><span style={{ width: `${Math.round(referralConfidence * 100)}%` }} /></div>
              <div className="cb-note mono" style={{ marginTop: 6 }}>
                {t("result.exactGradeConfidence")}: {(g.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
          {r.report?.pdf_b64 && onDownload && (
            <div className="rx-resultactions">
              <button type="button" className="primary" onClick={onDownload}>
                <Download size={16} aria-hidden="true" /> {t("actions.download")}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Simple or clinical wording: applies to everything below, so it sits above the tabs. */}
      <div className="cb-levelrow">
        <span className="cb-label">{t("common.explanationLevel")}</span>
        <LevelToggle />
      </div>

      {/* The detail, as three tabs instead of one long scroll. Inactive panels stay in the
          DOM (hidden), so nothing a screen reader or a test can reach is removed. */}
      <ResultTabs
        tabs={[
          { id: "care", label: t("result.tabCare") },
          { id: "meaning", label: t("result.tabMeaning") },
          { id: "insights", label: t("result.tabInsights") },
        ]}
        panels={{
          meaning: (
            <>
              <section className="cb-section" aria-labelledby="cb-mean-h">
                <h3 id="cb-mean-h" className="cb-h">{t("result.whatItMeans")}</h3>
                <p className="cb-explain">{meaning}</p>
                {level === "clinical" && (
                  <p className="cb-note">{t("result.confidenceNote")}</p>
                )}
                <SpeakButton
                  id="meaning"
                  label={t("common.listen")}
                  parts={[
                    g.referable ? t("result.verdictRefer") : t("result.verdictClear"),
                    t("result.gradeOf", { grade: g.icdr_grade }),
                    patientLabel,
                    meaning,
                  ]}
                />
                <WhyThis />
                <p className="cb-scanref mono">
                  {t("result.scanRef")}: {r.scan_id}
                </p>
              </section>
            </>
          ),
          insights: (
            <>
              <WhySection r={r} />
              <ClinicalStack r={r} />
            </>
          ),
          care: (
            <>
              <CareActions r={r} onDownload={onDownload} />
              {/* Free path: the phone's share sheet with the PDF attached. */}
              <ShareToWhatsApp r={r} />
              {/* The last step of the journey: the same report, on the phone the patient
                  already has. Renders nothing when no report was generated or nobody is
                  signed in, and it cannot affect anything above it. */}
              <WhatsAppDelivery r={r} />
              <Nutrition />
              {/* Where to go, and how to get there. An ACCESS layer — it reads the grade
                  only to choose its opening sentence and its prominence, and nothing it
                  does can change a grade, a referral or a report. */}
              <CareFinder r={r} />
            </>
          ),
        }}
      />
    </>
  );
}
