FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/notification ./services/notification
COPY server/database ./server/database
EXPOSE 5005
CMD ["node", "services/notification/src/index.js"]
