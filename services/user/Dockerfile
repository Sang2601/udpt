FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/user ./services/user
COPY server/database ./server/database
EXPOSE 8081
CMD ["node", "services/user/src/index.js"]

