FROM node:20-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...

FROM deps AS builder
COPY artifacts/api-server/ ./artifacts/api-server/
COPY lib/ ./lib/
RUN pnpm --filter @workspace/api-server run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 apiuser

COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json

USER apiuser

EXPOSE 8080
ENV PORT=8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
