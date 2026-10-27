FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/auth ./services/auth
COPY server/database ./server/database
EXPOSE 5001
CMD ["node", "services/auth/src/index.js"]
