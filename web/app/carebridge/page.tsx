"use client";
/**
 * CareBridge — the accessibility layer, on one page.
 *
 * Public on purpose. A person who cannot read English should not have to sign in before
 * they can put the interface into their own language, and a judge should not have to be
 * walked to it.
 */
import { Bell, BookOpen, Calendar, CircleCheck, Globe, Lightbulb, Microscope, Navigation, Phone, Pill, Volume2 } from "lucide-react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import { LanguageChoices } from "@/components/carebridge/LanguagePicker";
import SpeakButton from "@/components/carebridge/SpeakButton";
import WhyThis from "@/components/carebridge/WhyThis";
import CoveragePanel from "@/components/carebridge/CoveragePanel";

const JOURNEY = [
  { icon: <Microscope className="ico" size={16} strokeWidth={1.75} />, title: "journey.detect", body: "journey.detectBody" },
  { icon: <Lightbulb className="ico" size={16} strokeWidth={1.75} />, title: "journey.understand", body: "journey.understandBody" },
  { icon: <Volume2 className="ico" size={16} strokeWidth={1.75} />, title: "journey.communicate", body: "journey.communicateBody" },
  { icon: <Navigation className="ico" size={16} strokeWidth={1.75} />, title: "journey.guide", body: "journey.guideBody" },
  { icon: <CircleCheck className="ico" size={16} strokeWidth={1.75} />, title: "journey.act", body: "journey.actBody" },
] as const;

const FUTURE = [
  { icon: <Phone className="ico" size={16} strokeWidth={1.75} />, title: "future.telemedicine", body: "future.telemedicineBody" },
  { icon: <Calendar className="ico" size={16} strokeWidth={1.75} />, title: "future.appointments", body: "future.appointmentsBody" },
  { icon: <BookOpen className="ico" size={16} strokeWidth={1.75} />, title: "future.education", body: "future.educationBody" },
  { icon: <Bell className="ico" size={16} strokeWidth={1.75} />, title: "future.reminders", body: "future.remindersBody" },
  { icon: <Pill className="ico" size={16} strokeWidth={1.75} />, title: "future.medication", body: "future.medicationBody" },
] as const;

export default function CareBridgePage() {
  const { t, meta, level, setLevel, voice, setVoice } = useCareBridge();

  return (
    <Shell>
      <section className="cb-pagehero">
        <div className="eyebrow"><span aria-hidden="true"><Globe className="ico" size={16} strokeWidth={1.75} /></span> {t("common.appName")}</div>
        <h2>{t("onboarding.title")}</h2>
        <p className="cb-lede">{t("common.appTagline")} — {t("onboarding.subtitle")}</p>
        <LanguageChoices />
        <p className="cb-note">
          <span aria-hidden="true"><Volume2 className="ico" size={16} strokeWidth={1.75} /></span> {t("onboarding.voiceNote")} · {t("onboarding.changeLater")}
        </p>
        <SpeakButton
          id="carebridge-intro"
          parts={[t("onboarding.title"), t("onboarding.subtitle"), t("journey.intro")]}
        />
      </section>

      <section className="band" aria-labelledby="cb-j-h">
        <h3 id="cb-j-h">{t("journey.title")}</h3>
        <p className="intro">{t("journey.intro")}</p>
        <ol className="cb-journey">
          {JOURNEY.map((s, i) => (
            <li key={s.title}>
              <span className="cb-journeyicon" aria-hidden="true">{s.icon}</span>
              <span className="cb-journeystep mono">{String(i + 1).padStart(2, "0")}</span>
              <h4>{t(s.title)}</h4>
              <p>{t(s.body)}</p>
            </li>
          ))}
        </ol>
        <p className="cb-note">
          {t("common.curatedNote")} {t("auth.languageStays")}
        </p>
      </section>

      <section className="band" aria-labelledby="cb-p-h">
        <h3 id="cb-p-h">{t("common.explanationLevel")}</h3>
        <p className="intro">
          {t("common.simpleHint")} · {t("common.clinicalHint")}
        </p>
        <div className="cb-prefsrow">
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
          <button
            type="button"
            role="switch"
            aria-checked={voice}
            aria-label={t("a11y.voiceToggle")}
            className={`cb-switch${voice ? " on" : ""}`}
            onClick={() => setVoice(!voice)}
          >
            <span className="cb-switchtrack" aria-hidden="true"><span /></span>
            <span>{t("common.voiceGuidance")}: {voice ? t("common.on") : t("common.off")}</span>
          </button>
        </div>
        <p className="cb-note" lang={meta.locale}>{t("a11y.currentLanguage", { language: meta.nativeName })}</p>
        <div className="ctarow">
          <Link href="/screen" className="cta solid">{t("onboarding.startScreening")}</Link>
          <Link href="/how-it-works" className="cta line">{t("nav.howItWorks")}</Link>
        </div>
      </section>

      <section className="band" aria-labelledby="cb-f-h">
        <h3 id="cb-f-h">{t("future.title")}</h3>
        <p className="intro">{t("future.intro")}</p>
        <div className="steps">
          {FUTURE.map((f) => (
            <div className="step cb-futurestep" key={f.title}>
              <span className="n"><span aria-hidden="true">{f.icon}</span> {t("future.comingSoon")}</span>
              <h4>{t(f.title)}</h4>
              <p>{t(f.body)}</p>
            </div>
          ))}
        </div>
        <WhyThis />
      </section>

      <CoveragePanel />
    </Shell>
  );
}
