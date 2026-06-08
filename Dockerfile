FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/templates ./templates

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
