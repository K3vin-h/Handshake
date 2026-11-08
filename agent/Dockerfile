FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY plan.mjs server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
