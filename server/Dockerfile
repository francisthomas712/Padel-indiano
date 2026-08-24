FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript@^5.4.5 && npx tsc && npm uninstall typescript
CMD ["node", "dist/index.js"]
