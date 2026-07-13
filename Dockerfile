# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ARG NESA_APP_VERSION
ENV NESA_APP_VERSION=${NESA_APP_VERSION}
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ARG NESA_APP_VERSION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=20129
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/data
ENV NESA_APP_VERSION=${NESA_APP_VERSION}

RUN groupadd --system --gid 1001 nesa && useradd --system --uid 1001 --gid nesa nesa

# Keep the full Next standalone tree (may nest under app/ or repo folder name).
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./standalone
COPY --from=builder /app/.next/static ./standalone-static
COPY --from=builder /app/scripts/start-standalone.mjs ./scripts/start-standalone.mjs

# Normalize to the layout start-standalone.mjs expects: .next/standalone(+static)
RUN mkdir -p .next \
  && mv standalone .next/standalone \
  && mkdir -p .next/static \
  && cp -a standalone-static/. .next/static/ \
  && rm -rf standalone-static \
  && mkdir -p /app/data \
  && chown -R nesa:nesa /app

USER nesa

EXPOSE 20129
CMD ["node", "scripts/start-standalone.mjs"]
