# --- STEP 1: Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Prisma Client 생성
RUN npx prisma generate

# NestJS 빌드
RUN npm run build

# --- STEP 2: Run Stage ---
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# 빌드된 dist 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 8080
ENV NODE_ENV=production

# ✅ main 엔트리 경로 수정!
CMD ["node", "dist/src/main"]
