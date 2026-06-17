FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY index.html vite.config.ts svelte.config.js tsconfig.json tsconfig.node.json ./
COPY src ./src
COPY public ./public

EXPOSE 4321
CMD ["npm", "run", "dev"]
