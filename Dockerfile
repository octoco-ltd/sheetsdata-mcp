FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin/ ./bin/

ENTRYPOINT ["node", "bin/cli.js"]
