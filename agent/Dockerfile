FROM node:24-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY plan.mjs server.mjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
