#!/usr/bin/env bash
# Assemble the Hugging Face Space folder for the API.
#   deploy/build_hf_space.sh <output-dir>
# Copies only what the server needs: no data/, no web/, no tests, no secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: build_hf_space.sh <output-dir>}"
mkdir -p "$OUT"
rsync -a --delete --exclude '__pycache__' "$ROOT/src/" "$OUT/src/"
mkdir -p "$OUT/artifacts/model" "$OUT/results/quality_gate" "$OUT/results/active"
rsync -a "$ROOT/artifacts/model/" "$OUT/artifacts/model/"
cp "$ROOT/results/quality_gate/thresholds.json" "$OUT/results/quality_gate/"
cp "$ROOT/results/active/metrics.json" "$OUT/results/active/"
cp "$ROOT/requirements-serve.txt" "$OUT/"
cp "$ROOT/deploy/Dockerfile.hf" "$OUT/Dockerfile"
cat > "$OUT/README.md" <<'MD'
---
title: RETINEX DR Screening API
emoji: 👁️
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---
Inference API for RETINEX — diabetic retinopathy screening triage aid. Not a diagnostic device.
MD
cat > "$OUT/.gitattributes" <<'GA'
*.keras filter=lfs diff=lfs merge=lfs -text
*.npz filter=lfs diff=lfs merge=lfs -text
GA
echo "Space folder ready: $OUT"
