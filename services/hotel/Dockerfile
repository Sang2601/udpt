FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/hotel ./services/hotel
COPY server/database ./server/database
EXPOSE 5002
CMD ["node", "services/hotel/src/index.js"]
