FROM node:20-alpine

WORKDIR /app

# Needed for Dockerode edge cases + basic tooling
RUN apk add --no-cache bash curl

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
