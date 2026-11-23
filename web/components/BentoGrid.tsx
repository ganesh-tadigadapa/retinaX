/**
 * Home page bento grid: what RETINEX does, as a set of tiles of different sizes.
 * Dark glass cards with a soft violet glow; one periwinkle highlight tile.
 * Visuals use the bundled sample fundus photos in public/samples.
 */
import Link from "next/link";
import {
  ArrowRight, Crosshair, Flame, Languages, MapPin, ScanEye, Stethoscope, Sparkles,
} from "lucide-react";

const GRADES = [
  { g: 0, l: "No DR" },
  { g: 1, l: "Mild" },
  { g: 2, l: "Moderate" },
  { g: 3, l: "Severe" },
  { g: 4, l: "PDR" },
];

const LANGS = ["English", "हिन्दी", "ਪੰਜਾਬੀ", "తెలుగు"];

function More({ href, label = "See more" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="bento-more">
      {label} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

export default function BentoGrid() {
  return (
    <section className="bento-wrap" aria-labelledby="bento-title">
      <div className="bento-head">
        <span className="bento-pill"><Sparkles size={13} aria-hidden="true" /> Screening platform</span>
        <h2 id="bento-title">Everything a screening needs, in one place</h2>
      </div>

      <div className="bento">
        {/* Tall: grading */}
        <article className="bento-card b-grade">
          <span className="bento-icon"><ScanEye size={20} aria-hidden="true" /></span>
          <h3>AI severity grading</h3>
          <p>An ordinal model returns an ICDR grade from 0 to 4 and a refer / don’t-refer
            decision, with calibrated confidence.</p>
          <More href="/how-it-works" />
          <div className="bento-visual grade-visual" aria-hidden="true">
            <img src="/samples/aptos-grade2.png" alt="" className="fundus" />
            <div className="grade-scale">
              {GRADES.map(({ g, l }) => (
                <span key={g} className={g === 2 ? "on" : ""}>
                  <b>{g}</b>{l}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Highlight */}
        <article className="bento-card b-hi">
          <div className="hi-facets" aria-hidden="true" />
          <p className="hi-big">Screen.<br />Explain.<br />Refer.</p>
          <span className="hi-sub">In seconds, at the primary health centre.</span>
        </article>

        {/* Heatmap */}
        <article className="bento-card b-cam">
          <div className="bento-visual cam-visual" aria-hidden="true">
            <img src="/samples/aptos-grade3.png" alt="" className="fundus" />
            <span className="cam-blob c1" /><span className="cam-blob c2" />
          </div>
          <span className="bento-icon"><Flame size={20} aria-hidden="true" /></span>
          <h3>See why</h3>
          <p>A Grad-CAM heatmap shows where the model looked.</p>
        </article>

        {/* Quality gate, wide */}
        <article className="bento-card b-quality">
          <div>
            <span className="bento-icon"><Crosshair size={20} aria-hidden="true" /></span>
            <h3>Quality gate</h3>
            <p>Blurry, dark or off-centre photos are refused — never guessed at — with a
              specific instruction for retaking them.</p>
            <More href="/how-it-works" />
          </div>
          <div className="bento-visual quality-visual" aria-hidden="true">
            <img src="/samples/aptos-ungradeable-focus.png" alt="" className="fundus blur" />
            <div className="q-pill">
              <span className="q-dot" />
              Out of focus — hold the camera steady and retake
            </div>
          </div>
        </article>

        {/* Languages */}
        <article className="bento-card b-lang">
          <span className="bento-icon"><Languages size={20} aria-hidden="true" /></span>
          <h3>Speaks the patient’s language</h3>
          <p>Results and guidance, read aloud.</p>
          <div className="lang-chips">
            {LANGS.map((l) => <span key={l}>{l}</span>)}
          </div>
        </article>

        {/* Hospitals */}
        <article className="bento-card b-map">
          <span className="bento-icon"><MapPin size={20} aria-hidden="true" /></span>
          <h3>Nearby eye care</h3>
          <p>Referable result? Find the closest eye hospital.</p>
          <More href="/hospitals" label="Find hospitals" />
          <div className="map-dots" aria-hidden="true" />
        </article>

        {/* Doctor review */}
        <article className="bento-card b-doc">
          <span className="bento-icon"><Stethoscope size={20} aria-hidden="true" /></span>
          <h3>Doctor in the loop</h3>
          <p>Verified doctors confirm or correct every referable case.</p>
          <More href="/reports" label="Doctor reports" />
        </article>
      </div>
    </section>
  );
}
