FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY *.ts ./
RUN npm run build
RUN npm prune --production
EXPOSE 3456
CMD ["node", "dist/server-http.js"]
