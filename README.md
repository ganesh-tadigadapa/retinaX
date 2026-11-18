# RetinaX — Explainable AI for Diabetic Retinopathy Screening

Upload a photo of the back of the eye (a fundus image) and RetinaX returns a **diabetic
retinopathy severity grade (ICDR 0–4)**, a **refer / don't-refer** decision, a
**Grad-CAM heatmap** showing *why*, and a one-page PDF report a doctor can review in
under 30 seconds. Blurry or unusable photos are **rejected** with a clear instruction
for retaking them.

Built for **Smart India Hackathon (SIH26038)**.

> **Screening triage aid — not a diagnostic device.**

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?logo=tensorflow&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

---

## Why it matters

Diabetic retinopathy is a leading cause of preventable blindness, and India has far
too few eye specialists to screen everyone with diabetes. RetinaX lets a health
worker take a photo, get an instant triage result, and send only the patients who
need it to a doctor — with an explanation the doctor can check, in the patient's own
language.

## Features

| | Feature | What it does |
|---|---|---|
| 🔍 | **Image quality gate** | Checks sharpness, lighting and field of view; rejects bad photos with a specific retake instruction (HTTP 422) |
| 🧠 | **Severity grading** | CNN with an ordinal (CORAL) head predicts ICDR grade 0–4 and `P(grade ≥ 2)` for referral |
| 🔥 | **Explainability** | Grad-CAM heatmaps + a rule engine that cross-checks the prediction against ICDR clinical rules |
| 🩺 | **Segmentation** | Optic disc, fovea, blood vessels (Frangi filter) and lesion counts by quadrant |
| 📄 | **Doctor report** | Calibrated confidence and a one-page PDF; uncertain cases are flagged for doctor review |
| 🌐 | **CareBridge** | Results in **English, हिन्दी, తెలుగు, ਪੰਜਾਬੀ** with voice playback and a Simple ⇄ Clinical view |
| 🪪 | **Eye Health Passport** | Tracks screenings over time, compares with the last visit, and suggests a follow-up date |
| 💬 | **WhatsApp reports** | Sends the PDF report to the patient's WhatsApp number |
| 📍 | **Smart Care Finder** | Finds nearby eye-care facilities on a map (Google Places API) with directions |

## How it works

```
Fundus photo
   │
   ▼
Quality gate ──✗──► "Retake: image too blurry" (no grade given)
   │ ✓
   ▼
Enhancement → Segmentation (disc, fovea, vessels, lesions)
   │
   ▼
CNN + CORAL ordinal head ──► ICDR grade 0–4 + referral probability
   │
   ▼
Grad-CAM + ICDR rule cross-check + confidence calibration
   │
   ▼
PDF report → Doctor review queue → WhatsApp → Follow-up reminder
```

## Tech stack

| Layer | Tools |
|---|---|
| **ML / Computer Vision** | Python, TensorFlow, OpenCV, scikit-image, scikit-learn, NumPy |
| **Backend** | FastAPI, Pydantic, ReportLab (PDF) |
| **Frontend** | Next.js, React, TypeScript, Leaflet (maps) |
| **Integrations** | Google Places API, WhatsApp |
| **DevOps** | Docker, GitHub Actions (CI), Makefile, pytest |
| **Simulation** | MATLAB / Simulink (doctor workload with vs. without AI triage) |

## Key design decisions

- **Ordinal head, not softmax.** Grades are ordered (0 < 1 < … < 4), so the referral
  decision `P(grade ≥ 2)` comes straight out of the model with its own threshold.
- **Contrast-normalised sharpness, not Laplacian variance.** The textbook blur measure
  mistakes a healthy, smooth retina for a blurry one and would reject healthy eyes.
- **"Unknown", never "absent".** The rule engine reports *unknown* for signs it can't
  detect (venous beading, IRMA, neovascularisation), so the sickest patients are never
  under-graded.
- **Model runs in-process.** Grad-CAM needs gradients that a hosted prediction endpoint
  won't return — and it's cheaper.
- **Careful wording.** Comparing two visits says *"the result is one grade higher than
  last time"*, never *"your disease got worse"* — a test checks every grade pair.
- **No fake numbers.** The dashboard reads real metrics from `/v1/metrics`; if a run
  hasn't happened, it shows "not run yet".

## Project status

The full pipeline — quality gate → grading → explanation → report → web app — is built
and tested end to end. The current model is trained on **synthetic images** so it runs
without any dataset or cloud account, and this is clearly labelled in the API and UI.
The next step is training and evaluating on real fundus datasets (e.g. APTOS / EyePACS);
results will be published in `docs/BENCHMARKS.md`.

## Run it locally

```bash
make setup             # create venv + npm install
make synth             # generate test images
cp .env.example .env   # defaults are fine for local use
make api               # backend  → http://localhost:8080
make web               # frontend → http://localhost:3000
make test              # backend tests
make web-test          # frontend tests
```

Sign in at <http://localhost:3000/login> with any mobile number (there is no OTP in the
demo). To try the doctor view:

```bash
make doctors                               # list doctor accounts
make approve-doctor MOBILE=+919876543210   # approve one
```

Optional — Smart Care Finder needs a Google Maps key in `.env`
(`GOOGLE_MAPS_API_KEY=...`). Without it, the rest of the app works normally.

> Don't run `npm run build` while `make web` is running — use `make web-build` instead.

## Project structure

```
src/quality/    image quality gate + enhancement
src/segment/    optic disc, fovea, vessels, lesions
src/grading/    CORAL model, training, evaluation
src/explain/    Grad-CAM, calibration, ICDR rules, PDF report
src/passport/   screening history + follow-up plans
src/carefinder/ nearby eye-care search
src/api/        FastAPI backend
web/            Next.js frontend (incl. CareBridge translations)
matlab/         Simulink workflow + classical baseline
tests/          backend tests
docs/           detailed design docs
GUIDE/          plain-English walkthrough of the whole project
```

## Documentation

| File | About |
|---|---|
| `GUIDE/00_START_HERE.md` | Plain-English explanation of the whole project — start here |
| `docs/API_CONTRACT.md` | API endpoints and response format |
| `docs/AUTH.md` | Accounts, roles (user / doctor / admin) and their limits |
| `docs/CAREBRIDGE.md` | Multilingual + voice layer |
| `docs/PASSPORT.md` | Tracking screenings over time |
| `docs/CARE_FINDER.md` | Nearby care search, ranking and privacy rules |
| `docs/WHATSAPP.md` | WhatsApp report delivery |
| `docs/BENCHMARKS.md` | Model results (filled in as real runs complete) |

---

**Disclaimer:** RetinaX is a screening and triage aid built for a hackathon. It does not
replace an eye examination by a qualified ophthalmologist.
