# Generate the Prisma client in Linux, then carry it into the runtime image.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` is `prisma generate && nest build`: the client is generated
# from schema.prisma at build time, because it is pure code — no database needed.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Keep the CLI for startup migrations; reuse the install from the build stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 3001
# Migrations run at START, not at build: there is no database during a build, and
# the same image must be able to point at dev, staging or prod. `migrate deploy`
# only applies committed migration files — it never invents one, unlike migrate dev.
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
