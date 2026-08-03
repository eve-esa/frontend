# syntax=docker/dockerfile:1

# ── Base: install dependencies ──────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── Dev: hot-reloading Vite server (used by docker-compose) ─────────────────
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["yarn", "dev", "--host", "0.0.0.0", "--port", "5173"]

# ── Build: produce the static production bundle ─────────────────────────────
FROM base AS build
COPY . .
RUN yarn build

# ── Production: serve the bundle via nginx ──────────────────────────────────
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
