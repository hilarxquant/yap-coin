FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.js ./
RUN mkdir -p data
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.js"]
