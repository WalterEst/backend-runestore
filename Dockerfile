# Desarrollo: hot-reload con nest start --watch.
# Para producción se construye una imagen aparte (multi-stage) en la Fase 10 (hardening final).
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
