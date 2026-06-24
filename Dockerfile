FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS client-deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY --from=client-deps /app/client/node_modules ./node_modules
COPY client/package.json ./
COPY client/astro.config.mjs client/tsconfig.json ./
COPY client/src ./src
COPY client/public ./public
ENV API_BASE_URL=http://127.0.0.1:8000/api
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=8000
ENV SQLITE_PATH=/app/data/unlucky-boys.sqlite
ENV SQLITE_MIGRATIONS_DIR=/app/database-migrations
ENV UPLOAD_ROOT=/app/uploads
ENV API_BASE_URL=http://127.0.0.1:8000/api

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-deps /app/server/package.json ./server/package.json
COPY --from=client-deps /app/client/node_modules ./client/node_modules
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=client-deps /app/client/package.json ./client/package.json
COPY database-migrations ./database-migrations
COPY scripts ./scripts

RUN mkdir -p /app/data /app/uploads/news /app/uploads/players && chmod +x /app/scripts/start.sh

EXPOSE 4321
CMD ["/app/scripts/start.sh"]
