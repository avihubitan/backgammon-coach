# Backgammon Coach API. Build: docker build -t backgammon-coach-api .
# Run: docker run -p 3000:3000 -e MONGODB_URI=... -e TRUST_PROXY=1 backgammon-coach-api
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT:-3000}/v1/health || exit 1
CMD ["node", "dist/main.js"]
