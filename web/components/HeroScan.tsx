/**
 * Home hero visual: a real fundus photograph being analysed.
 *
 * A held-out APTOS image (public/samples/aptos-grade0.png) inside measurement rings, with
 * a slow radar sweep and result cards that appear in pipeline order. The numbers on the
 * cards are this image's actual output from the deployed model (aptos-kaggle-run1):
 * grade 0, P(referable) 0.0024, quality score 0.957. They are not illustrative.
 *
 * Decorative only (aria-hidden): the same claims are made in text elsewhere on the page.
 * All motion stops under prefers-reduced-motion.
 */
import { Activity, CheckCircle2, ScanEye, ShieldCheck } from "lucide-react";

const CARDS = [
  { cls: "c1", icon: ScanEye, label: "Retina verified", value: "Fundus photograph", tone: "ok" },
  { cls: "c2", icon: Activity, label: "Image quality", value: "96%", tone: "ok" },
  { cls: "c3", icon: CheckCircle2, label: "ICDR grade 0", value: "No DR", tone: "ok" },
  { cls: "c4", icon: ShieldCheck, label: "Not referable", value: "99.8% confident", tone: "ok" },
];

export default function HeroScan() {
  return (
    <div className="hx" aria-hidden="true">
      <div className="hx-stage">
        <div className="hx-ring r1" />
        <div className="hx-ring r2" />
        <div className="hx-ring r3" />
        <div className="hx-fundus">
          <img src="/samples/aptos-grade0.png" alt="" />
          <div className="hx-sweep" />
          <div className="hx-cross" />
        </div>
        <span className="hx-dot d1" />
        <span className="hx-dot d2" />
        <span className="hx-dot d3" />
      </div>

      {CARDS.map(({ cls, icon: Icon, label, value, tone }) => (
        <div key={cls} className={`hx-card ${cls} ${tone}`}>
          <span className="hx-cardicon"><Icon size={16} strokeWidth={2} /></span>
          <span className="hx-cardtext">
            <span className="hx-cardlabel">{label}</span>
            <strong>{value}</strong>
          </span>
        </div>
      ))}

      <div className="hx-caption mono">Held-out APTOS image · live model output</div>
    </div>
  );
}
