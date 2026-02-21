# vue-front/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# dist만 뽑아서 다른 컨테이너에서 쓰기 쉽게
FROM alpine:3.20 AS export
WORKDIR /out
COPY --from=build /app/dist ./dist