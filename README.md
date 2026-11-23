# RetinaX

I built RetinaX for Smart India Hackathon (problem statement SIH26038). The problem is diabetic retinopathy: it's one of the main causes of preventable blindness, and there aren't nearly enough eye specialists in India to check everyone with diabetes. The idea is that a health worker takes a photo of the back of the eye (a fundus image), gets a triage result straight away, and only the patients who actually need a doctor get sent to one.

You upload a fundus photo and RetinaX gives back a severity grade (ICDR 0 to 4), a refer / don't refer decision, a Grad-CAM heatmap showing which parts of the image drove the result, and a one-page PDF report for a doctor to check. If the photo is blurry or the retina isn't fully in frame, it refuses to grade it and tells you how to retake it.

It's a screening aid, not a diagnostic device.

## What it does

- **Quality check first.** It first checks the photo is actually a retina (screenshots, documents and ordinary photos are refused), then sharpness, lighting and field of view. Bad photos get an HTTP 422 with a specific instruction instead of a grade.
- **Grading.** A CNN (EfficientNetV2-S in TensorFlow/Keras) with an ordinal CORAL head predicts the ICDR grade and the probability of grade 2 or higher, which is what the referral decision uses.
- **Explanations.** Grad-CAM heatmaps, plus a small rule engine that cross-checks the predicted grade against the ICDR clinical rules. Confidence is calibrated with temperature scaling, and uncertain cases are flagged for a doctor.
- **Segmentation.** Optic disc, fovea, blood vessels (Frangi filter) and lesion counts per quadrant.
- **Doctor review.** A review queue in the web app, and doctor accounts that need to be approved by an admin.
- **CareBridge.** Results in English, Hindi, Telugu and Punjabi, with read-aloud (browser speech) and a simple vs clinical view.
- **Eye Health Passport.** Keeps a patient's screenings over time, compares with the last visit and suggests a follow-up window.
- **WhatsApp.** A free *Share to WhatsApp* button opens the phone's share sheet with the PDF attached. Automatic sending through Twilio or Meta is also built in, and stays hidden until it is configured.
- **Eye hospitals near you.** A map of nearby eye hospitals from OpenStreetMap, searchable by your location, a city, a district or a PIN code. It works offline for Indian place names and needs no API key. (An optional Google Places version is also built in.)

## How it works

```
fundus photo
   |
quality gate ---- fails ---> "retake: image out of focus" (no grade)
   | passes
enhancement -> segmentation (disc, fovea, vessels, lesions)
   |
CNN + CORAL head -> ICDR grade 0-4 + referral probability
   |
Grad-CAM + ICDR rule check + calibration
   |
PDF report -> doctor review -> WhatsApp -> follow-up
```

The backend is FastAPI (PDFs with ReportLab), the frontend is Next.js with TypeScript and MapLibre for the map. There's also a `matlab/` folder with a classical image processing baseline and a Simulink model of a district screening workflow (doctor workload with and without AI triage).

## Some decisions I made

- **Ordinal head instead of softmax.** The grades are ordered, so it made sense to model them that way. The referral probability `P(grade >= 2)` comes straight out of the model and gets its own threshold.
- **Not using Laplacian variance for blur.** The usual blur measure thinks a healthy, smooth retina is blurry, so it would reject healthy eyes. I use a contrast-normalised Tenengrad score instead (the comparison is in `results/quality_gate/`).
- **"Unknown", not "absent".** Some signs (venous beading, IRMA, neovascularisation) the pipeline can't detect, so the rule engine reports them as unknown. That way it never quietly under-grades the sickest patients.
- **Careful wording.** When comparing two visits it says something like "the result is one ICDR category higher than the previous screening", never "your disease got worse". There's a test that checks this for every pair of grades.
- **No made-up numbers on the dashboard.** It reads metrics from `/v1/metrics`, and if nothing has been run it just says so.

## Status

The whole pipeline (quality gate, grading, explanation, report, web app) works end to end and is tested.

The grading model is an EfficientNetV2-S with a CORAL head, trained on the APTOS 2019 dataset (12 epochs, 512px, on a Kaggle P100):

| | APTOS validation | IDRiD external holdout |
|---|---|---|
| QWK | 0.92 | 0.69 |
| Referable sensitivity | 0.92 | 0.86 |
| Referable specificity | 0.93 | 0.90 |

To be clear about what these mean: the validation numbers are on the same split the thresholds were tuned on, and the drop on IDRiD shows the model doesn't generalise to a new camera/hospital as well yet (it misses the 90% sensitivity target there). Improving that is the next step. Full details are in `docs/STATE.md` and `docs/BENCHMARKS.md`. The trained weights aren't committed to the repo. If you run it with the synthetic demo model instead, the API and UI label every result as coming from a synthetic model.

## Running it

The setup target expects Python 3.11 from Homebrew (macOS) and Node for the frontend.

```bash
make setup             # venv + npm install
make synth             # generate the synthetic test images
cp .env.example .env   # defaults are fine locally
make api               # backend on http://localhost:8080
make web               # frontend on http://localhost:3000
make test              # backend tests
make web-test          # frontend tests
```

Run `make` on its own to see every target.

Sign-in is **Sign in with Google**. Create an OAuth client (Web application, origin `http://localhost:3000`), then set `GOOGLE_CLIENT_ID` in `.env` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `web/.env.local`. Emails listed in `ADMIN_EMAILS` become admins on first sign-in. To try the doctor side, sign up as a doctor with another Google account, then:

```bash
make doctors                                   # list doctor accounts
make approve-doctor EMAIL=doctor@gmail.com     # approve one
```

The eye hospital map needs no key. The optional Google-based Care Finder needs `GOOGLE_MAPS_API_KEY` in `.env`.

One thing that caught me out: don't run `npm run build` while `make web` is running, they share `web/.next` and break each other. `make web-build` checks for this.

## Layout

```
src/quality/     quality gate + enhancement
src/segment/     disc, fovea, vessels, lesions
src/grading/     model, training, evaluation
src/explain/     Grad-CAM, calibration, ICDR rules, PDF report
src/passport/    screening history + follow-up
src/carefinder/  nearby eye care search
src/delivery/    WhatsApp
src/auth/        accounts and roles
src/api/         FastAPI app
web/             Next.js frontend
matlab/          classical baseline + Simulink workflow
tests/           backend tests
docs/            design notes (API, auth, CareBridge, passport, care finder, WhatsApp, benchmarks)
GUIDE/           plain English walkthrough of the project
```

If you want the longer explanation, start with `GUIDE/00_START_HERE.md`.
