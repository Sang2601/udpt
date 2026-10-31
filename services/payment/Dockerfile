FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY services/payment ./services/payment
COPY server/database ./server/database
EXPOSE 8084
CMD ["node", "services/payment/src/index.js"]

