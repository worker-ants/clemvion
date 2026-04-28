# Build context must be the repo root so that ../packages/* are reachable.
#   docker build -f backend/Dockerfile -t idea-workflow/backend .

# ---------- deps: install all deps (incl. native compile for bcrypt) ----------
# node:24-alpine ships with npm 11.x, which matches the npm version used to
# author package-lock.json. Older majors (22/23) ship npm 10.x and cause
# `npm ci` lockfile-shape mismatches.
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY packages/expression-engine/package.json packages/expression-engine/package-lock.json packages/expression-engine/tsconfig.json ./packages/expression-engine/
COPY packages/expression-engine/src ./packages/expression-engine/src
RUN cd packages/expression-engine && npm ci && npm run build

COPY packages/node-summary/package.json packages/node-summary/package-lock.json packages/node-summary/tsconfig.json ./packages/node-summary/
COPY packages/node-summary/src ./packages/node-summary/src
RUN cd packages/node-summary && npm ci && npm run build

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Prune devDeps from @workflow packages AFTER backend `npm ci` has consumed
# them as file: deps. Pruning earlier would remove typescript and break the
# `prepare` script that npm re-runs while resolving file: deps.
RUN cd packages/expression-engine && npm prune --omit=dev \
    && cd ../node-summary && npm prune --omit=dev

# ---------- builder: compile TypeScript ----------
FROM deps AS builder
WORKDIR /app
COPY backend ./backend
RUN cd backend && npm run build && npm prune --omit=dev

# ---------- runner: minimal runtime ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist
COPY --from=builder --chown=node:node /app/backend/package.json ./backend/package.json

USER node
WORKDIR /app/backend
EXPOSE 3011
CMD ["node", "dist/main"]
