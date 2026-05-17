#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh
# Manual one-shot deployment to Azure (bypasses GitHub Actions).
# Use this for hotfixes or first-time deploys before CI/CD is wired up.
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh [frontend|api|all]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RESOURCE_GROUP="addup-rg"
ACR_NAME="addupacr"
API_APP_NAME="addup-api"
FRONTEND_APP_NAME="addup-frontend"
TAG="${GITHUB_SHA:-$(git rev-parse --short HEAD)}"

TARGET="${1:-all}"

deploy_frontend() {
  echo ""
  echo "── Deploying frontend ──────────────────────────"
  echo "→ Building Vite..."
  pnpm install --frozen-lockfile
  NODE_ENV=production pnpm --filter @workspace/addup run build

  echo "→ Fetching Static Web Apps deployment token..."
  SWA_TOKEN=$(az staticwebapp secrets list \
    --name "$FRONTEND_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" -o tsv)

  echo "→ Uploading to Azure Static Web Apps..."
  npx @azure/static-web-apps-cli deploy \
    artifacts/addup/dist/public \
    --deployment-token "$SWA_TOKEN" \
    --env production

  echo "Frontend deployed."
}

deploy_api() {
  echo ""
  echo "── Deploying API ────────────────────────────────"
  IMAGE="$ACR_NAME.azurecr.io/addup-api:$TAG"

  echo "→ Logging in to ACR..."
  az acr login --name "$ACR_NAME"

  echo "→ Building Docker image: $IMAGE"
  docker build -f artifacts/api-server/Dockerfile -t "$IMAGE" .

  echo "→ Pushing image..."
  docker push "$IMAGE"

  echo "→ Deploying to App Service..."
  az webapp config container set \
    --name "$API_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --container-image-name "$IMAGE"

  az webapp restart \
    --name "$API_APP_NAME" \
    --resource-group "$RESOURCE_GROUP"

  API_URL=$(az webapp show \
    --name "$API_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName -o tsv)

  echo "API deployed → https://$API_URL"
}

case "$TARGET" in
  frontend) deploy_frontend ;;
  api)      deploy_api      ;;
  all)      deploy_frontend; deploy_api ;;
  *)
    echo "Usage: ./scripts/deploy.sh [frontend|api|all]"
    exit 1
    ;;
esac

echo ""
echo "Done."
