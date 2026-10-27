FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY gateway ./gateway
EXPOSE 5000
CMD ["node", "gateway/src/index.js"]
