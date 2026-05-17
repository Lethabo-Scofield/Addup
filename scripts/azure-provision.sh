#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# azure-provision.sh
# Provisions all Azure resources needed to run Addup.
#
# Usage:
#   chmod +x scripts/azure-provision.sh
#   ./scripts/azure-provision.sh
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Permissions: Contributor on the target subscription
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config (edit these) ───────────────────────────────────────────────────────
RESOURCE_GROUP="addup-rg"
LOCATION="eastus"
ACR_NAME="addupacr"
API_APP_NAME="addup-api"
FRONTEND_APP_NAME="addup-frontend"
APP_SERVICE_PLAN="addup-plan"
PG_SERVER_NAME="addup-postgres"
PG_DATABASE="addup"
PG_ADMIN_USER="addup_admin"
PG_SKU="Standard_B1ms"
PG_TIER="Burstable"
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Addup — Azure provisioning"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Resource group
echo "→ Creating resource group: $RESOURCE_GROUP"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table

# 2. Azure Container Registry
echo ""
echo "→ Creating Azure Container Registry: $ACR_NAME"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output table

# 3. App Service Plan (Linux)
echo ""
echo "→ Creating App Service Plan: $APP_SERVICE_PLAN"
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --is-linux \
  --sku B1 \
  --output table

# 4. App Service (API)
echo ""
echo "→ Creating App Service for API: $API_APP_NAME"
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
az webapp create \
  --name "$API_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --deployment-container-image-name "$ACR_LOGIN_SERVER/addup-api:latest" \
  --output table

# Enable managed identity and grant ACR pull
echo ""
echo "→ Configuring managed identity for App Service → ACR pull"
PRINCIPAL_ID=$(az webapp identity assign \
  --name "$API_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId -o tsv)

ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)

az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role AcrPull \
  --scope "$ACR_ID" \
  --output table

# 5. Azure Static Web Apps (Frontend)
echo ""
echo "→ Creating Azure Static Web App: $FRONTEND_APP_NAME"
az staticwebapp create \
  --name "$FRONTEND_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Free \
  --output table

STATIC_URL=$(az staticwebapp show \
  --name "$FRONTEND_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostname -o tsv)

# 6. PostgreSQL Flexible Server
echo ""
echo "→ Creating PostgreSQL Flexible Server: $PG_SERVER_NAME"
read -rsp "Enter a strong PostgreSQL admin password: " PG_PASSWORD
echo ""

az postgres flexible-server create \
  --name "$PG_SERVER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --admin-user "$PG_ADMIN_USER" \
  --admin-password "$PG_PASSWORD" \
  --database-name "$PG_DATABASE" \
  --sku-name "$PG_SKU" \
  --tier "$PG_TIER" \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0 \
  --output table

PG_HOST=$(az postgres flexible-server show \
  --name "$PG_SERVER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query fullyQualifiedDomainName -o tsv)

DATABASE_URL="postgresql://${PG_ADMIN_USER}:${PG_PASSWORD}@${PG_HOST}/${PG_DATABASE}?sslmode=require"

# 7. Set App Service environment variables
echo ""
echo "→ Configuring API environment variables"
az webapp config appsettings set \
  --name "$API_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="$DATABASE_URL" \
  --output table

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Provisioning complete."
echo ""
echo "  Frontend:    https://$STATIC_URL"
echo "  API:         https://$API_APP_NAME.azurewebsites.net"
echo "  PostgreSQL:  $PG_HOST"
echo ""
echo "  Next steps:"
echo "  1. Add AZURE_STATIC_WEB_APPS_API_TOKEN to GitHub secrets"
echo "  2. Add AZURE_CREDENTIALS to GitHub secrets (service principal JSON)"
echo "  3. Add RESEND_API_KEY to GitHub secrets"
echo "  4. Add DATABASE_URL to GitHub secrets"
echo "  5. Push to main — GitHub Actions deploys automatically"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
