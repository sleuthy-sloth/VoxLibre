# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci
COPY tsconfig.json ./tsconfig.json
COPY next.config.ts ./next.config.ts
COPY postcss.config.mjs ./postcss.config.mjs
COPY tailwind.config.ts ./tailwind.config.ts
COPY public ./public
COPY src ./src
COPY courses ./courses
COPY scripts ./scripts
COPY README.md ./README.md
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
# prisma migrate deploy is run on container start so deploys are applied before serving traffic
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
