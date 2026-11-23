"use client";
/**
 * The landing page's detail, as one tabbed panel instead of four stacked bands. Same
 * content as before — pipeline, graded requirements, CareBridge, and scope — but the
 * visitor picks what they want to read rather than scrolling past all of it.
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import CareBridgeBand from "@/components/carebridge/CareBridgeBand";

const STEPS = [
  { n: "01", h: "Capture and upload", p: "A health worker photographs the retina. The browser shrinks the image before upload — a raw fundus JPEG is 6 MB and rural uplink is slow." },
  { n: "02", h: "Quality gate", p: "Focus, illumination and field of view are checked first. An ungradeable image is refused with a specific instruction for retaking it, never guessed at." },
  { n: "03", h: "Grade and explain", p: "An ordinal CNN returns an ICDR grade and a referral decision, with a Grad-CAM heatmap showing what drove it." },
  { n: "04", h: "Cross-check and report", p: "Classical CV counts lesions by quadrant and applies the ICDR clinical rules independently. Disagreements are surfaced, not hidden." },
];

const REQS = [
  { n: "1", h: "Image quality & enhancement", p: "Three checks with thresholds fitted against human labels; CLAHE and Ben-Graham rescue borderline images.", e: "HTTP 422 plus the failed criterion" },
  { n: "2", h: "Structure segmentation", p: "Optic disc, fovea, Frangi vessels, and lesions by classical morphology at full resolution.", e: "Lesion counts per quadrant; Dice vs DRIVE" },
  { n: "3", h: "DR severity grading", p: "EfficientNetV2-S with a CORAL ordinal head, so P(referable) is a direct output with its own tunable threshold.", e: "QWK, sensitivity and specificity with CIs" },
  { n: "4", h: "Explainability", p: "Grad-CAM measured against real lesion masks, the ICDR rule engine as a second opinion, temperature-scaled confidence.", e: "Attribution inside lesions; ECE before/after" },
  { n: "5", h: "Workflow simulation", p: "The district screening programme as a discrete-event model: arrivals, recapture loops, review queue.", e: "Ophthalmologist FTEs with and without AI" },
];

type TabId = "pipeline" | "requirements" | "languages" | "scope";
const TABS: { id: TabId; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "requirements", label: "Requirements" },
  { id: "languages", label: "Languages" },
  { id: "scope", label: "Scope & limitations" },
];

export default function HomeExplorer() {
  const [tab, setTab] = useState<TabId>("pipeline");

  return (
    <section className="explorer">
      <div className="utabs" role="tablist" aria-label="Explore the system">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`utab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="explorer-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "pipeline" && (
          <>
            <div className="panel-head">
              <h3>What happens to an image</h3>
              <p>One request, one pass, a few seconds. Every stage is timed and the timings come back with the result.</p>
            </div>
            <ol className="pro-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="pro-step-n">Step {s.n}</span>
                  <h4>{s.h}</h4>
                  <p>{s.p}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {tab === "requirements" && (
          <>
            <div className="panel-head">
              <h3>The five graded requirements</h3>
              <p>Each one has a module and a measured output. Where a number has not been produced yet, the interface says so.</p>
            </div>
            <div className="tblwrap">
              <table className="pro-table">
                <thead>
                  <tr><th style={{ width: 44 }}>#</th><th>Requirement</th><th>Method</th><th>Evidence produced</th></tr>
                </thead>
                <tbody>
                  {REQS.map((r) => (
                    <tr key={r.n}>
                      <td className="mono muted">{r.n}</td>
                      <td><strong>{r.h}</strong></td>
                      <td>{r.p}</td>
                      <td className="muted">{r.e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "languages" && <CareBridgeBand />}

        {tab === "scope" && (
          <>
            <div className="panel-head">
              <h3>Intended use</h3>
              <p>
                A screening triage aid, not a diagnostic device. Every referable case goes to
                a clinician, and cases where the model and the clinical rules disagree are
                escalated rather than averaged.
              </p>
            </div>
            <div className="pro-scope">
              <div>
                <h4>Within scope</h4>
                <ul>
                  <li><Check size={16} aria-hidden="true" className="t-ok" />Flag referable DR for clinician review</li>
                  <li><Check size={16} aria-hidden="true" className="t-ok" />Refuse ungradeable images with a retake instruction</li>
                  <li><Check size={16} aria-hidden="true" className="t-ok" />Show the evidence behind every grade</li>
                </ul>
              </div>
              <div>
                <h4>Out of scope</h4>
                <ul>
                  <li><X size={16} aria-hidden="true" className="t-no" />Diagnosing or discharging a patient</li>
                  <li><X size={16} aria-hidden="true" className="t-no" />Averaging away model / rule disagreements</li>
                  <li><X size={16} aria-hidden="true" className="t-no" />Detecting every lesion type — some are missed entirely</li>
                </ul>
              </div>
            </div>
            <Link href="/limitations" className="pro-link">
              Read the full limitations <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
