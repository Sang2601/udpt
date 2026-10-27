FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/booking ./services/booking
COPY server/database ./server/database
EXPOSE 5003
CMD ["node", "services/booking/src/index.js"]
