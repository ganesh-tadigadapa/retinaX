#!/usr/bin/env bash
# Push the current code + model to the server and (re)build/start everything.
#   deploy/aws/deploy.sh <server-ip>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IP="${1:?usage: deploy.sh <server-ip>}"
KEY="${KEY:-$HOME/.ssh/retinax-aws.pem}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new ubuntu@$IP"
STAGE="$(mktemp -d)"
"$ROOT/deploy/build_hf_space.sh" "$STAGE/api" >/dev/null
rsync -az --delete -e "ssh -i $KEY" "$STAGE/api/" "ubuntu@$IP:/opt/retinax/api/"
rsync -az --delete -e "ssh -i $KEY" --exclude node_modules --exclude '.next*' --exclude tests \
      --exclude '.env*' --exclude '*.tsbuildinfo' "$ROOT/web/" "ubuntu@$IP:/opt/retinax/web/"
rsync -az -e "ssh -i $KEY" "$ROOT/deploy/aws/docker-compose.yml" "$ROOT/deploy/aws/Caddyfile" "ubuntu@$IP:/opt/retinax/"
rm -rf "$STAGE"
$SSH "cd /opt/retinax && docker compose up -d --build"
