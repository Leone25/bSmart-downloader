FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY index.js ./
COPY LICENSE ./
COPY README.md ./

RUN mkdir -p /app/temp

ENV NODE_ENV=production \
    OUTPUT_DIR=/output

ENTRYPOINT ["node", "index.js"]

