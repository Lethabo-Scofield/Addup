# Addup — Azure Deployment Guide

## Project structure

```
/
├── artifacts/
│   ├── addup/          Frontend — React + Vite SPA
│   └── api-server/     API — Express 5 + Drizzle + PostgreSQL
├── engine/             Reconciliation engine (Node.js core logic)
├── lib/                Shared workspace packages (db schema, api types)
├── scripts/
│   ├── azure-provision.sh   One-shot Azure resource provisioning
│   └── deploy.sh            Manual deploy (frontend / api / all)
├── .github/workflows/
│   └── azure-deploy.yml     CI/CD (GitHub Actions)
├── azure-pipelines.yml      CI/CD (Azure DevOps alternative)
├── artifacts/api-server/Dockerfile
└── .env.azure.example
```

## Azure architecture

| Component   | Azure service                        | Tier        |
|-------------|--------------------------------------|-------------|
| Frontend    | Azure Static Web Apps                | Free        |
| API         | Azure App Service (Linux container)  | B1          |
| Database    | Azure Database for PostgreSQL        | Burstable B1|
| Registry    | Azure Container Registry             | Basic       |

## First-time setup

### 1. Install prerequisites

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az login

# Docker (for manual deploys)
# https://docs.docker.com/get-docker/
```

### 2. Provision Azure resources

```bash
chmod +x scripts/azure-provision.sh
./scripts/azure-provision.sh
```

This creates: resource group, ACR, App Service Plan, App Service (API),
Azure Static Web Apps (frontend), and PostgreSQL Flexible Server.

### 3. Add GitHub Actions secrets

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret name                          | How to get it                                        |
|--------------------------------------|------------------------------------------------------|
| `AZURE_CREDENTIALS`                  | `az ad sp create-for-rbac --sdk-auth`                |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`    | `az staticwebapp secrets list --name addup-frontend` |
| `DATABASE_URL`                       | Output from `azure-provision.sh`                     |
| `RESEND_API_KEY`                     | https://resend.com/api-keys                          |

### 4. Push to deploy

```bash
git push origin main
```

GitHub Actions runs automatically:
- Builds the Vite frontend → deploys to Azure Static Web Apps
- Builds the Docker image → pushes to ACR → deploys to App Service

## Manual deploy (without GitHub Actions)

```bash
# Deploy everything
./scripts/deploy.sh all

# Frontend only
./scripts/deploy.sh frontend

# API only
./scripts/deploy.sh api
```

## Running database migrations

```bash
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run db:push
```

## Local development

```bash
pnpm install
pnpm --filter @workspace/addup run dev      # frontend at localhost:PORT
pnpm --filter @workspace/api-server run dev # API at localhost:PORT
```

## Environment variables

See `.env.azure.example` for the full list of required variables.
