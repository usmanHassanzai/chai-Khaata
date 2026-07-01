FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=3001
ENV CORS_ALLOW_ALL=true

EXPOSE 3001

VOLUME ["/app/server/data"]

CMD ["node", "server/index.js"]
