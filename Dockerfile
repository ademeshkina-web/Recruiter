# --- build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Docker сам ставит HOSTNAME = ID контейнера; Next standalone тогда слушает
# не тот адрес и снаружи не открывается. Явно слушаем на всех интерфейсах.
ENV HOSTNAME=0.0.0.0
# standalone-вывод содержит только нужные файлы и мини-сервер
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
# Ключ передаётся при запуске: docker run -e ANTHROPIC_API_KEY=... -p 3000:3000 recruiter
CMD ["node", "server.js"]
