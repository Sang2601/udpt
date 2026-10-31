FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/room ./services/room
COPY server/database ./server/database
EXPOSE 8083 8086
CMD ["node", "services/room/src/index.js"]

