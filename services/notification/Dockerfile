# deps -> builder -> runner. The final image carries no source and no compiler.

FROM node:22-alpine AS deps
WORKDIR /app
# package.json alone first: this layer is cached until dependencies actually
# change, so editing a .ts file does not reinstall node_modules.
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Only production dependencies reach the running image.
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3004
USER node
CMD ["node", "dist/main.js"]
