import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Shell from "@/components/Shell";
import LanguageOnboarding from "@/components/carebridge/LanguagePicker";
import HomeExplorer from "@/components/HomeExplorer";
import HeroScan from "@/components/HeroScan";
import BentoGrid from "@/components/BentoGrid";

/** Drop a photo at public/hero-eye.(jpg|png|webp) and the hero uses it. */
function heroPhoto(): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", `hero-eye.${ext}`))) return `/hero-eye.${ext}`;
  }
  return null;
}

export default function Home() {
  const photo = heroPhoto();
  return (
    <Shell>
      {/* The language question is asked once, before anything else, and never again. */}
      <LanguageOnboarding />

      <section className="rx-hero">
        <div className="rx-hero-copy">
          <h1>
            AI-Powered Retinal Screening for{" "}
            <span className="rx-accent">Healthier Tomorrows</span>
          </h1>
          <p className="rx-hero-tag">Detect. Understand. Get Care.</p>
          <p className="rx-hero-lede">
            Upload a retinal photo and get an AI screening result in seconds — an ICDR
            grade, the evidence behind it, personalised guidance, and nearby eye-care
            support.
          </p>
          <div className="rx-hero-actions">
            <Link href="/screen" className="cta solid lg">
              Start Screening <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/how-it-works" className="cta line lg">Learn More</Link>
          </div>
        </div>

        <div className={`rx-hero-art${photo ? " photo" : ""}`} aria-hidden="true">
          {photo ? (
            <img src={photo} alt="" className="rx-hero-photo" />
          ) : (
            <HeroScan />
          )}
        </div>
      </section>

      <BentoGrid />

      <HomeExplorer />
    </Shell>
  );
}
