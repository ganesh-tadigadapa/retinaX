"use client";
/**
 * Sample images built into the app.
 *
 * A judge will not be carrying a fundus photograph. Without this they cannot try the
 * product at all, and the single most persuasive moment in the demo — a deliberately
 * blurry image being refused with a useful instruction — depends on having a blurry
 * image to hand. Two taps, no file, no preparation.
 *
 * These are REAL APTOS 2019 fundus photographs from the held-out validation split --
 * none of them was seen during training. Each manifest entry carries its source image
 * id and its ground-truth grade, so a prediction can be checked against the label live.
 *
 * One exception, labelled `modified` in the manifest: the field-of-view sample is a real
 * held-out image cropped to 40% width to simulate a mis-framed capture. APTOS contains
 * almost no naturally ungradeable images -- our quality gate refused 1 of 550 validation
 * images and 0 of 400 test images -- so a natural FOV failure was not available.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Sample = {
  file: string; title: string; description: string; expect: "graded" | "refused";
  source?: string; true_grade?: number; modified?: boolean;
};

export default function Samples({
  onPick, disabled,
}: { onPick: (f: File, s: Sample) => void; disabled?: boolean }) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/samples/manifest.json")
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  if (!samples.length) return null;

  const pick = async (s: Sample) => {
    const res = await fetch(`/samples/${s.file}`);
    const blob = await res.blob();
    onPick(new File([blob], s.file, { type: blob.type || "image/jpeg" }), s);
  };

  const scroll = (dir: number) =>
    stripRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });

  return (
    <div className="rx-samples">
      <div className="rx-sampleshead">
        <span className="rx-samplestitle">Try a sample image</span>
        <span className="rx-samplesnote">
          Real APTOS photographs held out of training. The last two are deliberately bad —
          they should be refused, not graded.
        </span>
      </div>
      <div className="rx-samplesrow">
        <button type="button" className="rx-iconbtn rx-arrow" onClick={() => scroll(-1)} aria-label="Previous samples">
          <ChevronLeft size={18} />
        </button>
        <div className="rx-strip" ref={stripRef}>
          {samples.map((s) => (
            <button
              key={s.file}
              className="rx-thumb"
              onClick={() => pick(s)}
              disabled={disabled}
              aria-label={`Try sample: ${s.title}`}
              title={`${s.title} — ${s.description}`}
            >
              <img src={`/samples/${s.file}`} alt={s.title} />
              <span className={`rx-thumbtag ${s.expect === "refused" ? "refuse" : "grade"}`}>
                {s.expect === "refused" ? "Should refuse" : `Grade ${s.true_grade ?? "?"}`}
              </span>
              <span className="rx-thumbtitle">{s.title}</span>
            </button>
          ))}
        </div>
        <button type="button" className="rx-iconbtn rx-arrow" onClick={() => scroll(1)} aria-label="More samples">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
